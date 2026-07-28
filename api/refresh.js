import { kv } from "../lib/kv.js";
import { refresh, refreshOne } from "./cron/refresh.js";
import { verifySession, parseCookies } from "../lib/session.js";

// Bouton « Actualiser » du classement.
// - Connecté : on ne recalcule QUE cette personne (léger, surtout pour qu'un
//   nouvel inscrit se voie tout de suite). Petit cooldown perso.
// - Anonyme : recalcul complet, cooldown plus long (évite de pilonner GitHub).
const FULL_COOLDOWN_MS = 120_000;
const ONE_COOLDOWN_MS = 15_000;

function sessionLogin(req, opts) {
  if (opts.login !== undefined) return opts.login;
  const secret = opts.sessionSecret ?? process.env.SESSION_SECRET;
  if (!secret) return null;
  const sess = verifySession(parseCookies(req?.headers?.cookie).gw_session, secret);
  return sess && sess.login ? sess.login : null;
}

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const now = opts.now || Date.now();
  const login = sessionLogin(req, opts);

  if (login) {
    const cd = opts.oneCooldownMs ?? ONE_COOLDOWN_MS;
    const since = now - ((await store.get("refresh:one:" + login)) || 0);
    if (since < cd) return res.status(200).json({ throttled: true, retryInSec: Math.ceil((cd - since) / 1000) });
    await store.set("refresh:one:" + login, now);
    return res.status(200).json(await refreshOne(login, { ...opts, kv: store, now }));
  }

  const cd = opts.cooldownMs ?? FULL_COOLDOWN_MS;
  const since = now - ((await store.get("refresh:last")) || 0);
  if (since < cd) return res.status(200).json({ throttled: true, retryInSec: Math.ceil((cd - since) / 1000) });
  await store.set("refresh:last", now);
  return res.status(200).json({ ok: true, ...(await refresh({ ...opts, kv: store, now })) });
}

export default handler;
