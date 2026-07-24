import { kv } from "../lib/kv.js";

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const snap = await store.get("snapshot");
  res.setHeader("Cache-Control", "public, max-age=120");
  if (!snap) return res.status(200).json({ updatedAt: null, empty: true });
  return res.status(200).json(snap);
}

export default handler;
