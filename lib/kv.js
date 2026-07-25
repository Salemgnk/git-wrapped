import fs from "node:fs";
import path from "node:path";

export function makeKv({ url, token, fetchImpl = fetch }) {
  async function cmd(args) {
    const r = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!r.ok) throw new Error("kv http " + r.status);
    return (await r.json()).result;
  }
  return {
    async get(key) { const v = await cmd(["GET", key]); return v == null ? null : JSON.parse(v); },
    async set(key, val) { return cmd(["SET", key, JSON.stringify(val)]); },
    async sadd(key, member) { return cmd(["SADD", key, member]); },
    async srem(key, member) { return cmd(["SREM", key, member]); },
    async smembers(key) { return (await cmd(["SMEMBERS", key])) || []; },
  };
}

// Fallback local (self-host sans service cloud) : un fichier JSON tient tous les stores.
export function makeFileKv(dir) {
  const file = path.join(dir, "kv.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; } };
  const write = (o) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(o)); };
  return {
    async get(key) { const o = read(); return key in o ? o[key] : null; },
    async set(key, val) { const o = read(); o[key] = val; write(o); },
    async sadd(key, member) { const o = read(); const s = new Set(o[key] || []); s.add(member); o[key] = [...s]; write(o); },
    async srem(key, member) { const o = read(); o[key] = (o[key] || []).filter((x) => x !== member); write(o); },
    async smembers(key) { return read()[key] || []; },
  };
}

// Vercel KV / Upstash si configuré (noms de vars des deux intégrations), sinon
// stockage fichier local (self-host).
export function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return makeKv({ url, token });
  return makeFileKv(process.env.KV_DIR || ".data");
}
