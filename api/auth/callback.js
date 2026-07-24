import { kv } from "../../lib/kv.js";
import { signSession, parseCookies } from "../../lib/session.js";

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const fetchImpl = opts.fetchImpl || fetch;
  const secret = opts.secret ?? process.env.SESSION_SECRET;
  const clientId = opts.clientId ?? process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = opts.clientSecret ?? process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const { code, state } = req.query || {};
  const cookies = parseCookies(req.headers?.cookie);
  if (!code || !state || state !== cookies.gw_oauth_state)
    return res.status(400).json({ error: "bad state" });

  const tok = await fetchImpl("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const { access_token } = await tok.json();
  if (!access_token) return res.status(502).json({ error: "oauth failed" });

  const u = await fetchImpl("https://api.github.com/user", {
    headers: { Authorization: "Bearer " + access_token, "User-Agent": "git-wrapped" },
  });
  const { login } = await u.json();
  if (!login) return res.status(502).json({ error: "no login" });

  await store.sadd("participants", login);
  res.setHeader("Set-Cookie", [
    "gw_oauth_state=; Path=/; Max-Age=0",
    `gw_session=${signSession({ login }, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
  ]);
  res.setHeader("Location", "/classement?joined=" + encodeURIComponent(login));
  return res.status(302).end();
}
export default handler;
