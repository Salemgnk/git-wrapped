import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../api/app/installed.js";
import { signSession } from "../lib/session.js";

function mockRes() {
  return { code: 0, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }, end() { return this; } };
}
function fakeKv() { const m = {}; return { store: m, async set(k, v) { m[k] = v; }, async get(k) { return m[k] ?? null; } }; }

test("installed: connecté -> enregistre l'installation + redirige", async () => {
  const kv = fakeKv();
  const req = { query: { installation_id: "42" },
    headers: { cookie: "gw_session=" + signSession({ login: "alice" }, "s") } };
  const res = mockRes();
  await handler(req, res, { kv, secret: "s" });
  assert.equal(res.code, 302);
  assert.equal(kv.store["installation:alice"], "42");
  assert.ok(String(res.headers.Location).includes("connected=1"));
});

test("installed: anonyme -> redirige vers le login, rien enregistré", async () => {
  const kv = fakeKv();
  const req = { query: { installation_id: "42" }, headers: {} };
  const res = mockRes();
  await handler(req, res, { kv, secret: "s" });
  assert.equal(res.code, 302);
  assert.ok(String(res.headers.Location).includes("/api/auth/start"));
  assert.equal(Object.keys(kv.store).length, 0);
});
