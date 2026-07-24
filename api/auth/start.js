import crypto from "node:crypto";

export async function handler(req, res, opts = {}) {
  const clientId = opts.clientId ?? process.env.GITHUB_OAUTH_CLIENT_ID;
  const base = "https://" + (req.headers?.host || "localhost");
  const state = crypto.randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie",
    `gw_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  const url = "https://github.com/login/oauth/authorize?client_id=" + encodeURIComponent(clientId) +
    "&scope=read:user&state=" + state +
    "&redirect_uri=" + encodeURIComponent(base + "/api/auth/callback");
  res.setHeader("Location", url);
  return res.status(302).end();
}
export default handler;
