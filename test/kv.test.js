import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeKv, makeFileKv } from "../lib/kv.js";

function fakeFetch(store) {
  return async (url, opts) => {
    const [cmd, key, val] = JSON.parse(opts.body);
    let result = null;
    if (cmd === "SET") { store.set(key, val); result = "OK"; }
    else if (cmd === "GET") result = store.get(key) ?? null;
    else if (cmd === "SADD") { const s = store.get(key) || []; if (!s.includes(val)) s.push(val); store.set(key, s); result = 1; }
    else if (cmd === "SREM") { const s = store.get(key) || []; store.set(key, s.filter((m) => m !== val)); result = 1; }
    else if (cmd === "SMEMBERS") result = store.get(key) || [];
    return { ok: true, json: async () => ({ result }) };
  };
}

test("makeKv: set/get JSON, sadd/smembers/srem", async () => {
  const kv = makeKv({ url: "http://kv", token: "t", fetchImpl: fakeFetch(new Map()) });
  await kv.set("snap", { a: 1 });
  assert.deepEqual(await kv.get("snap"), { a: 1 });
  assert.equal(await kv.get("missing"), null);
  await kv.sadd("p", "alice");
  await kv.sadd("p", "bob");
  await kv.srem("p", "alice");
  assert.deepEqual(await kv.smembers("p"), ["bob"]);
});

test("makeFileKv: même interface, persiste dans un fichier JSON local", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kvfile-"));
  const kv = makeFileKv(dir);
  await kv.set("snapshot", { updatedAt: "x" });
  assert.deepEqual(await kv.get("snapshot"), { updatedAt: "x" });
  assert.equal(await kv.get("missing"), null);
  await kv.sadd("participants", "alice");
  await kv.sadd("participants", "alice"); // idempotent
  await kv.sadd("participants", "bob");
  await kv.srem("participants", "alice");
  assert.deepEqual(await kv.smembers("participants"), ["bob"]);
  // persistance : une nouvelle instance relit le même fichier
  assert.deepEqual(await makeFileKv(dir).smembers("participants"), ["bob"]);
  fs.rmSync(dir, { recursive: true, force: true });
});
