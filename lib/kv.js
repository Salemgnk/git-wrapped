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

export function kv() {
  return makeKv({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}
