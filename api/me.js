import { verifySession, parseCookies } from "../lib/session.js";
import { kv } from "../lib/kv.js";

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const secret = opts.secret ?? process.env.SESSION_SECRET;
  const slug = opts.appSlug ?? process.env.GH_APP_SLUG;
  const sess = secret ? verifySession(parseCookies(req.headers?.cookie).gw_session, secret) : null;
  if (!sess || !sess.login) return res.status(200).json({ login: null });
  const installed = !!(await store.get("installation:" + sess.login));
  const install_url = slug ? "https://github.com/apps/" + slug + "/installations/new" : null;
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ login: sess.login, private_connected: installed, install_url });
}

export default handler;
