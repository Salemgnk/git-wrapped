import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../api/me.js";
import { signSession } from "../lib/session.js";

function mockRes() {
  return { code: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }, end() { return this; } };
}
const fakeKv = (map = {}) => ({ async get(k) { return k in map ? map[k] : null; } });

test("me: anonyme -> login null", async () => {
  const res = mockRes();
  await handler({ headers: {} }, res, { secret: "s", kv: fakeKv() });
  assert.deepEqual(res.body, { login: null });
});

test("me: connecté sans installation", async () => {
  const req = { headers: { cookie: "gw_session=" + signSession({ login: "alice" }, "s") } };
  const res = mockRes();
  await handler(req, res, { secret: "s", kv: fakeKv(), appSlug: "git-wrapped" });
  assert.equal(res.body.login, "alice");
  assert.equal(res.body.private_connected, false);
  assert.ok(res.body.install_url.includes("git-wrapped"));
});

test("me: connecté avec installation", async () => {
  const req = { headers: { cookie: "gw_session=" + signSession({ login: "alice" }, "s") } };
  const res = mockRes();
  await handler(req, res, { secret: "s", kv: fakeKv({ "installation:alice": "42" }), appSlug: "git-wrapped" });
  assert.equal(res.body.private_connected, true);
});
