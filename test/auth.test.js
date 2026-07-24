import { test } from "node:test";
import assert from "node:assert/strict";
import { handler as callback } from "../api/auth/callback.js";
import { handler as leave } from "../api/leave.js";
import { signSession } from "../lib/session.js";

function mockRes() {
  return { code: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = (this.headers[k] || []).concat(v); },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }, end() { return this; } };
}
function fakeKv() {
  const set = new Set();
  return { added: set, async sadd(_, m) { set.add(m); }, async srem(_, m) { set.delete(m); } };
}

test("callback: state OK -> ajoute participant + session + redirect", async () => {
  const kv = fakeKv();
  const fakeFetch = async (url) => {
    if (url.includes("access_token")) return { ok: true, json: async () => ({ access_token: "gho_x" }) };
    return { ok: true, json: async () => ({ login: "alice", avatar_url: "a.png" }) };
  };
  const req = { query: { code: "c", state: "s1" }, headers: { cookie: "gw_oauth_state=s1" } };
  const res = mockRes();
  await callback(req, res, { kv, fetchImpl: fakeFetch, secret: "sess", clientId: "id", clientSecret: "sec" });
  assert.equal(res.code, 302);
  assert.ok(kv.added.has("alice"));
  assert.ok(String(res.headers["Location"]).includes("/classement"));
});

test("callback: state incohérent -> 400, aucun ajout", async () => {
  const kv = fakeKv();
  const req = { query: { code: "c", state: "s1" }, headers: { cookie: "gw_oauth_state=AUTRE" } };
  const res = mockRes();
  await callback(req, res, { kv, fetchImpl: async () => ({ ok: true, json: async () => ({}) }), secret: "sess", clientId: "id", clientSecret: "sec" });
  assert.equal(res.code, 400);
  assert.equal(kv.added.size, 0);
});

test("leave: retire le participant de la session", async () => {
  const kv = fakeKv(); kv.added.add("alice");
  const req = { headers: { cookie: "gw_session=" + signSession({ login: "alice" }, "sess") } };
  const res = mockRes();
  await leave(req, res, { kv, secret: "sess" });
  assert.equal(res.code, 200);
  assert.equal(kv.added.has("alice"), false);
});
