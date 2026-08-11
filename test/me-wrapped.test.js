import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handler } from "../api/me/wrapped.js";
import { signSession } from "../lib/session.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs1", format: "pem" });

function mockRes() {
  return { code: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }, end() { return this; } };
}
const fakeKv = (map = {}) => ({ async get(k) { return k in map ? map[k] : null; } });
const auth = () => ({ cookie: "gw_session=" + signSession({ login: "alice" }, "s") });

test("me/wrapped: anonyme -> 401", async () => {
  const res = mockRes();
  await handler({ headers: {}, query: {} }, res, { secret: "s", token: "tok", kv: fakeKv() });
  assert.equal(res.code, 401);
});

test("me/wrapped: connecté sans installation -> public only + no-store", async () => {
  // fetchWrapped (public) : Q_MAIN vide.
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: { user: {
    id: "N1", avatarUrl: "a", contributionsCollection: { commitContributionsByRepository: [] },
    repositories: { nodes: [] } } } }) });
  const res = mockRes();
  await handler({ headers: auth(), query: {} }, res,
    { secret: "s", token: "tok", kv: fakeKv(), fetchImpl: fakeFetch });
  assert.equal(res.code, 200);
  assert.equal(res.body.private_included, false);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});

test("me/wrapped: connecté avec installation -> fusionne le privé", async () => {
  const fakeFetch = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    if (url.includes("/access_tokens")) return { ok: true, json: async () => ({ token: "ghs_inst" }) };
    if (url.includes("/installation/repositories"))
      return { ok: true, json: async () => ({ repositories: [
        { name: "secret", private: true, owner: { login: "alice" } } ] }) };
    // GraphQL : distingue par la présence de "languages" vs "history" dans la query.
    if (body && body.query.includes("commitContributionsByRepository")) // Q_MAIN (public)
      return { ok: true, json: async () => ({ data: { user: { id: "N1", avatarUrl: "a",
        contributionsCollection: { commitContributionsByRepository: [] }, repositories: { nodes: [] } } } }) };
    if (body && body.query.includes("languages(first:6)") && body.query.includes("repository(owner")
        && !body.query.includes("history")) // Q_REPO_LANGS
      return { ok: true, json: async () => ({ data: { repository: { languages: { edges: [] } } } }) };
    // Q_HISTORY (privé)
    return { ok: true, json: async () => ({ data: { repository: { defaultBranchRef: { target: {
      history: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
        { committedDate: "2026-03-01T10:00:00Z", messageHeadline: "wip", additions: 1, deletions: 0 } ] } } } } } }) };
  };
  const res = mockRes();
  await handler({ headers: auth(), query: {} }, res, { secret: "s", token: "tok",
    kv: fakeKv({ "installation:alice": "42" }), appId: "123", privateKey: pem, fetchImpl: fakeFetch });
  assert.equal(res.code, 200);
  assert.equal(res.body.private_included, true);
  assert.equal(res.body.total_commits, 1); // le commit privé est bien compté
  assert.deepEqual(res.body.commits_split, { public: 0, private: 1 });
});
