import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWrapped, bounds } from "../lib/github-client.js";

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
