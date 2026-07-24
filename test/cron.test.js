import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../api/cron/refresh.js";

function mockRes() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}
function memKv(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async set(k, v) { m.set(k, v); },
    async sadd(k, x) { const s = m.get(k) || []; if (!s.includes(x)) s.push(x); m.set(k, s); },
    async srem(k, x) { m.set(k, (m.get(k) || []).filter((e) => e !== x)); },
    async smembers(k) { return m.get(k) || []; } };
}

test("cron: refuse sans CRON_SECRET", async () => {
  const res = mockRes();
  await handler({ headers: {} }, res, { cronSecret: "s", kv: memKv() });
  assert.equal(res.code, 401);
});

test("cron: calcule et ecrit le snapshot", async () => {
  const kv = memKv({ participants: ["alice"] });
  const fakeFetchWrapped = async () => ({ avatar: "a.png",
    reposByCommits: [{ name: "app", owner: "alice" }],
    commits: [{ repo: "app", committedDate: "2026-06-14T10:00:00Z", additions: 5, deletions: 0 }] });
  const res = mockRes();
  await handler({ headers: { authorization: "Bearer s" } }, res,
    { cronSecret: "s", kv, fetchWrapped: fakeFetchWrapped, now: Date.UTC(2026, 5, 15), year: 2026 });
  assert.equal(res.code, 200);
  assert.equal(kv.m.get("snapshot").devs.year[0].login, "alice");
});

test("cron: erreur non-404 -> garde le snapshot precedent", async () => {
  const kv = memKv({ participants: ["alice"], snapshot: { updatedAt: "old" } });
  const fail = async () => { throw new Error("rate limited"); };
  const res = mockRes();
  await handler({ headers: { authorization: "Bearer s" } }, res,
    { cronSecret: "s", kv, fetchWrapped: fail, now: Date.now(), year: 2026 });
  assert.equal(res.body.skipped, true);
  assert.equal(kv.m.get("snapshot").updatedAt, "old"); // inchangé
});
