import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWrapped, bounds, fetchPrivateCommits } from "../lib/github-client.js";

test("fetchPrivateCommits agrège commits + langages d'un repo privé", async () => {
  let call = 0;
  const fakeFetch = async () => {
    call++;
    if (call === 1) // Q_REPO_LANGS
      return { ok: true, json: async () => ({ data: { repository: { languages: { edges: [
        { size: 120, node: { name: "Rust" } } ] } } } }) };
    // Q_HISTORY
    return { ok: true, json: async () => ({ data: { repository: { defaultBranchRef: { target: {
      history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
        { committedDate: "2026-03-01T10:00:00Z", messageHeadline: "wip", additions: 4, deletions: 1 } ] } } } } } }) };
  };
  const out = await fetchPrivateCommits({ userId: "NODE1",
    repos: [{ owner: "alice", name: "secret" }],
    period: { from: "2026-01-01", to: "2026-12-31" }, token: "ghs_inst", fetchImpl: fakeFetch });
  assert.equal(out.commits.length, 1);
  assert.equal(out.commits[0].repo, "secret");
  assert.deepEqual(out.languages, [{ ext: ".rs", count: 120 }]);
  assert.deepEqual(out.reposByCommits, [{ name: "secret", owner: "alice", count: 1 }]);
});

test("bounds accepte une plage custom et une année", () => {
  assert.deepEqual(bounds({ from: "2025-06-01", to: "2025-08-31" }),
    { fromD: "2025-06-01", toD: "2025-08-31",
      from: "2025-06-01T00:00:00Z", to: "2025-08-31T23:59:59Z" });
  assert.equal(bounds(2024).from, "2024-01-01T00:00:00Z");
});

test("fetchWrapped expose id et bornes de période", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: { user: {
    id: "NODE1", avatarUrl: "a", contributionsCollection: { commitContributionsByRepository: [] },
    repositories: { nodes: [] } } } }) });
  const out = await fetchWrapped("alice", { from: "2026-02-01", to: "2026-02-28" }, "tok", fakeFetch);
  assert.equal(out.id, "NODE1");
  assert.equal(out.from, "2026-02-01");
  assert.equal(out.to, "2026-02-28");
});

test("fetchWrapped expose l'avatar", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ data: { user: { id: "1", avatarUrl: "https://av/a.png",
      contributionsCollection: { commitContributionsByRepository: [] },
      repositories: { nodes: [] } } } }),
  });
  const out = await fetchWrapped("alice", 2026, "tok", fakeFetch);
  assert.equal(out.avatar, "https://av/a.png");
  assert.equal(out.user, "alice");
});

test("fetchWrapped exclut les repos privés", async () => {
  // 1er appel = Q_MAIN, appels suivants = Q_HISTORY (aucun ici, pas de repo public retenu).
  let call = 0;
  const fakeFetch = async () => {
    call++;
    if (call === 1)
      return { ok: true, json: async () => ({ data: { user: { id: "1", avatarUrl: "a",
        contributionsCollection: { commitContributionsByRepository: [
          { repository: { name: "secret", owner: { login: "alice" }, isPrivate: true }, contributions: { totalCount: 99 } },
          { repository: { name: "public-repo", owner: { login: "alice" }, isPrivate: false }, contributions: { totalCount: 3 } },
        ] },
        repositories: { nodes: [] } } } }) };
    // Q_HISTORY pour public-repo : historique vide
    return { ok: true, json: async () => ({ data: { repository: { defaultBranchRef: { target: {
      history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } } } }) };
  };
  const out = await fetchWrapped("alice", 2026, "tok", fakeFetch);
  const names = out.reposByCommits.map(r => r.name);
  assert.deepEqual(names, ["public-repo"]);
  assert.ok(!names.includes("secret"));
});

test("les commits publics ne sont pas marqués privés", async () => {
  const fakeFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.query.includes("commitContributionsByRepository"))
      return { ok: true, json: async () => ({ data: { user: { id: "N1", avatarUrl: "a",
        contributionsCollection: { commitContributionsByRepository: [
          { repository: { name: "open", owner: { login: "alice" }, isPrivate: false },
            contributions: { totalCount: 1 } } ] },
        repositories: { nodes: [] } } } }) };
    return { ok: true, json: async () => ({ data: { repository: { defaultBranchRef: { target: {
      history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
        { committedDate: "2026-03-01T10:00:00Z", messageHeadline: "feat", additions: 2, deletions: 0 } ] } } } } } }) };
  };
  const out = await fetchWrapped("alice", 2026, "tok", fakeFetch);
  assert.equal(out.commits.length, 1);
  assert.equal(out.commits[0].private, false);
});

test("fetchPrivateCommits marque ses commits comme privés", async () => {
  let call = 0;
  const fakeFetch = async () => {
    call++;
    if (call === 1)
      return { ok: true, json: async () => ({ data: { repository: { languages: { edges: [] } } } }) };
    return { ok: true, json: async () => ({ data: { repository: { defaultBranchRef: { target: {
      history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
        { committedDate: "2026-03-01T10:00:00Z", messageHeadline: "wip", additions: 1, deletions: 0 } ] } } } } } }) };
  };
  const out = await fetchPrivateCommits({ userId: "N1", repos: [{ owner: "alice", name: "secret" }],
    period: 2026, token: "ghs_inst", fetchImpl: fakeFetch });
  assert.equal(out.commits[0].private, true);
});
