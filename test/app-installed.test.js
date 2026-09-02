import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handler } from "../api/app/installed.js";
import { signSession } from "../lib/session.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs1", format: "pem" });

function mockRes() {
  return { code: 0, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }, end() { return this; } };
}
function fakeKv() { const m = {}; return { store: m, async set(k, v) { m[k] = v; }, async get(k) { return m[k] ?? null; } }; }

// GET /app/installations/{id} -> compte propriétaire de l'installation
const instFetch = (login, type = "User") => async (url) => {
  assert.ok(url.includes("/app/installations/"), "appel inattendu: " + url);
  return { ok: true, json: async () => ({ account: { login, type } }) };
};
const req = (login, id = "42") => ({ query: { installation_id: id },
  headers: { cookie: "gw_session=" + signSession({ login }, "s") } });
const opts = extra => ({ secret: "s", appId: "123", privateKey: pem, ...extra });

test("installed: installation appartenant à l'utilisateur -> enregistrée + redirige", async () => {
  const kv = fakeKv(); const res = mockRes();
  await handler(req("alice"), res, opts({ kv, fetchImpl: instFetch("alice") }));
  assert.equal(res.code, 302);
  assert.equal(kv.store["installation:alice"], "42");
  assert.ok(String(res.headers.Location).includes("connected=1"));
});

test("installed: anonyme -> redirige vers le login, rien enregistré", async () => {
  const kv = fakeKv(); const res = mockRes();
  await handler({ query: { installation_id: "42" }, headers: {} }, res, opts({ kv }));
  assert.equal(res.code, 302);
  assert.ok(String(res.headers.Location).includes("/api/auth/start"));
  assert.equal(Object.keys(kv.store).length, 0);
});

// --- l'installation_id vient de la query : il doit être prouvé, pas cru ---

test("installed: installation d'un AUTRE compte -> 403, rien enregistré", async () => {
  const kv = fakeKv(); const res = mockRes();
  // mallory est connectée, mais soumet l'installation_id de bob (ids séquentiels)
  await handler(req("mallory"), res, opts({ kv, fetchImpl: instFetch("bob") }));
  assert.equal(res.code, 403);
  assert.equal(Object.keys(kv.store).length, 0);
});

test("installed: installation d'organisation -> 403 explicite, rien enregistré", async () => {
  const kv = fakeKv(); const res = mockRes();
  await handler(req("alice"), res, opts({ kv, fetchImpl: instFetch("acme-corp", "Organization") }));
  assert.equal(res.code, 403);
  assert.match(String(res.headers.Location), /app_error=org/);  // motif lisible sur la landing
  assert.equal(Object.keys(kv.store).length, 0);
});

test("installed: login comparé sans tenir compte de la casse", async () => {
  const kv = fakeKv(); const res = mockRes();
  await handler(req("Alice"), res, opts({ kv, fetchImpl: instFetch("alice") }));
  assert.equal(res.code, 302);
  assert.equal(kv.store["installation:Alice"], "42");
});

test("installed: GitHub refuse le lookup -> pas d'enregistrement", async () => {
  const kv = fakeKv(); const res = mockRes();
  await handler(req("alice"), res, opts({ kv, fetchImpl: async () => ({ ok: false, status: 404 }) }));
  assert.ok(res.code >= 400, "doit échouer, code reçu: " + res.code);
  assert.equal(Object.keys(kv.store).length, 0);
});

test("installed: sans clés d'app, on refuse au lieu de croire la query", async () => {
  const kv = fakeKv(); const res = mockRes();
  await handler(req("alice"), res, { secret: "s", kv });
  assert.ok(res.code >= 400, "doit échouer, code reçu: " + res.code);
  assert.equal(Object.keys(kv.store).length, 0);
});
