import { kv } from "../lib/kv.js";
import { verifySession, parseCookies } from "../lib/session.js";

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const secret = opts.secret ?? process.env.SESSION_SECRET;
  const sess = verifySession(parseCookies(req.headers?.cookie).gw_session, secret);
  if (!sess) return res.status(401).json({ error: "not signed in" });
  await store.srem("participants", sess.login);
  res.setHeader("Set-Cookie", "gw_session=; Path=/; Max-Age=0");
  return res.status(200).json({ ok: true, left: sess.login });
}
export default handler;
