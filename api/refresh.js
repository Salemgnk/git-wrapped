import { kv } from "../lib/kv.js";
import { refresh } from "./cron/refresh.js";

// Refresh public déclenché par le bouton « Actualiser » du classement (surtout
// pour qu'un nouvel inscrit se voie sans attendre le cron). Protégé par un
// cooldown partagé (KV) : le 1er clic recalcule, les suivants sont temporisés,
// ce qui évite de marteler l'API GitHub.
const COOLDOWN_MS = 60_000;

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const now = opts.now || Date.now();
  const cooldown = opts.cooldownMs ?? COOLDOWN_MS;

  const last = (await store.get("refresh:last")) || 0;
  const since = now - last;
  if (since < cooldown) {
    return res.status(200).json({ throttled: true, retryInSec: Math.ceil((cooldown - since) / 1000) });
  }

  await store.set("refresh:last", now); // pose le verrou AVANT de lancer (anti-rafale)
  const r = await refresh({ ...opts, kv: store, now });
  return res.status(200).json({ ok: true, ...r });
}

export default handler;
