import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../api/refresh.js";

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

test("refresh public: 1er appel recalcule, 2e temporisé (cooldown)", async () => {
  const kv = memKv({ participants: ["alice"] });
  const fakeFetchWrapped = async () => ({ avatar: "a",
    reposByCommits: [{ name: "app", owner: "alice" }],
    commits: [
      { repo: "app", committedDate: "2026-06-14T10:00:00Z", additions: 5, deletions: 0 },
      { repo: "app", committedDate: "2026-06-13T10:00:00Z", additions: 5, deletions: 0 },
      { repo: "app", committedDate: "2026-06-12T10:00:00Z", additions: 5, deletions: 0 },
    ] });
  // login: null -> chemin anonyme (refresh complet)
  const opts = { kv, login: null, fetchWrapped: fakeFetchWrapped, now: Date.UTC(2026, 5, 15), year: 2026, cooldownMs: 60000 };

  const r1 = mockRes();
  await handler({}, r1, opts);
  assert.equal(r1.body.ok, true);
  assert.ok(kv.m.get("snapshot"));            // snapshot écrit

  const r2 = mockRes();
  await handler({}, r2, opts);                // même now -> dans le cooldown
  assert.equal(r2.body.throttled, true);
  assert.ok(r2.body.retryInSec > 0);
});

test("refresh connecté: ne recalcule que soi et se voit dans le snapshot", async () => {
  const kv = memKv({ participants: ["alice", "bob"] });
  let fetched = [];
  const fakeFetchWrapped = async (login) => {
    fetched.push(login);
    return { avatar: login + ".png", reposByCommits: [{ name: "app", owner: login }],
      commits: [
        { repo: "app", committedDate: "2026-06-14T10:00:00Z", additions: 5, deletions: 0 },
        { repo: "app", committedDate: "2026-06-13T10:00:00Z", additions: 5, deletions: 0 },
        { repo: "app", committedDate: "2026-06-12T10:00:00Z", additions: 5, deletions: 0 },
      ] };
  };
  const opts = { kv, login: "bob", fetchWrapped: fakeFetchWrapped, now: Date.UTC(2026, 5, 15), year: 2026 };
  const res = mockRes();
  await handler({}, res, opts);
  assert.equal(res.body.ok, true);
  assert.deepEqual(fetched, ["bob"]);                       // seul bob refetché
  const devs = kv.m.get("snapshot").devs.year.map((d) => d.login);
  assert.ok(devs.includes("bob"));                          // bob apparaît
});
