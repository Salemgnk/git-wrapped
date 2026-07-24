import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWrapped } from "../lib/github-client.js";

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
