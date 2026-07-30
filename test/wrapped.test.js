import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../api/wrapped.js";

function res() {
  return { code: 200, body: null, headers: {},
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    json(o) { this.body = o; return this; },
    end(s) { this.body = s; return this; } };
}

test("rejects invalid username (400) before any network", async () => {
  const r = res();
  await handler({ query: { user: "bad name!" } }, r, { token: "t", fetchImpl: () => { throw new Error("no net"); } });
  assert.equal(r.code, 400);
});

test("503 when token missing", async () => {
  const r = res();
  await handler({ query: { user: "octocat" } }, r, { token: "", fetchImpl: () => {} });
  assert.equal(r.code, 503);
});

test("404 when github reports no user", async () => {
  const r = res();
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: { user: null } }) });
  await handler({ query: { user: "ghost" } }, r, { token: "t", fetchImpl: fakeFetch });
  assert.equal(r.code, 404);
});

function ghMock() {
  return async (_url, init) => {
    const q = JSON.parse(init.body).query;
    if (q.includes("contributionsCollection")) {
      return { ok: true, json: async () => ({ data: { user: {
        id: "U1",
        contributionsCollection: {
          totalCommitContributions: 2,
          contributionCalendar: { weeks: [
            { contributionDays: [{ date: "2026-01-01", contributionCount: 2 }] }] },
          commitContributionsByRepository: [
            { repository: { name: "alpha", owner: { login: "org-x" } },
              contributions: { totalCount: 2 } }] },
        repositories: { nodes: [
          { languages: { edges: [{ size: 100, node: { name: "TypeScript" } }] } }] } } } }) };
    }
    return { ok: true, json: async () => ({ data: { repository: { defaultBranchRef: {
      target: { history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
        { committedDate: "2026-01-01T03:00:00Z", messageHeadline: "fix bug", additions: 5, deletions: 1 },
        { committedDate: "2026-01-01T14:00:00Z", messageHeadline: "add feature", additions: 3, deletions: 0 }
      ] } } } } } }) };
  };
}

test("200 with a valid contract on the happy path", async () => {
  const r = res();
  await handler({ query: { user: "someone", year: "2026" } }, r, { token: "t", fetchImpl: ghMock() });
  assert.equal(r.code, 200);
  assert.equal(r.body.empty, false);
  assert.equal(r.body.total_commits, 2);          // somme du calendrier
  assert.deepEqual(r.body.projects.top_repos[0], { name: "alpha", count: 2 });
  assert.equal(r.body.projects.top_file, null);
  assert.equal(r.body.volume.added, 8);           // 5+3 depuis les historiques
  assert.equal(r.body.volume.deleted, 1);
  assert.ok(r.body.contributions.weeks.length > 0);
  assert.equal(r.headers["Cache-Control"], "public, max-age=600");
});

test("wrapped: from/to invalides -> repli sur l'année", async () => {
  let seenPeriod = null;
  const fakeFetchWrapped = async (user, period) => { seenPeriod = period;
    return { user, from: "2026-01-01", to: "2026-12-31", id: "1", avatar: "a",
      reposByCommits: [], commits: [], languages: [] }; };
  const r = res();
  await handler({ query: { user: "alice", from: "bad", to: "2026-12-31" } }, r,
    { token: "tok", fetchWrapped: fakeFetchWrapped });
  assert.equal(typeof seenPeriod, "number"); // année, pas { from, to }
  assert.equal(r.code, 200);
});

test("wrapped: from/to valides -> période custom", async () => {
  let seenPeriod = null;
  const fakeFetchWrapped = async (user, period) => { seenPeriod = period;
    return { user, from: "2026-02-01", to: "2026-02-28", id: "1", avatar: "a",
      reposByCommits: [], commits: [], languages: [] }; };
  const r = res();
  await handler({ query: { user: "alice", from: "2026-02-01", to: "2026-02-28" } }, r,
    { token: "tok", fetchWrapped: fakeFetchWrapped });
  assert.deepEqual(seenPeriod, { from: "2026-02-01", to: "2026-02-28" });
});
