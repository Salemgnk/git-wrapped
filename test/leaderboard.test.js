import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../api/leaderboard.js";

function mockRes() {
  return { code: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; } };
}

test("leaderboard: renvoie le snapshot", async () => {
  const snap = { updatedAt: "x", devs: {}, repos: {} };
  const res = mockRes();
  await handler({}, res, { kv: { async get() { return snap; } } });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, snap);
});

test("leaderboard: snapshot absent -> empty", async () => {
  const res = mockRes();
  await handler({}, res, { kv: { async get() { return null; } } });
  assert.equal(res.code, 200);
  assert.equal(res.body.empty, true);
});
