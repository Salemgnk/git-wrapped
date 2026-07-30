import { verifySession, parseCookies } from "../../lib/session.js";
import { kv } from "../../lib/kv.js";

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const secret = opts.secret ?? process.env.SESSION_SECRET;
  const sess = secret ? verifySession(parseCookies(req.headers?.cookie).gw_session, secret) : null;
  if (!sess || !sess.login) { res.setHeader("Location", "/api/auth/start"); return res.status(302).end(); }
  const installationId = req.query && req.query.installation_id;
  if (!installationId) return res.status(400).json({ error: "missing installation_id" });
  await store.set("installation:" + sess.login, String(installationId));
  res.setHeader("Location", "/?connected=1");
  return res.status(302).end();
}

export default handler;
