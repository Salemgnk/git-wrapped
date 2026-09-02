import { verifySession, parseCookies } from "../../lib/session.js";
import { getInstallationAccount } from "../../lib/github-app.js";
import { kv } from "../../lib/kv.js";

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const secret = opts.secret ?? process.env.SESSION_SECRET;
  const appId = opts.appId ?? process.env.GH_APP_ID;
  const privateKey = opts.privateKey ?? process.env.GH_APP_PRIVATE_KEY;
  const fetchImpl = opts.fetchImpl || fetch;

  const sess = secret ? verifySession(parseCookies(req.headers?.cookie).gw_session, secret) : null;
  if (!sess || !sess.login) { res.setHeader("Location", "/api/auth/start"); return res.status(302).end(); }
  const installationId = req.query && req.query.installation_id;
  if (!installationId) return res.status(400).json({ error: "missing installation_id" });
  // Sans les clés de l'App on ne peut rien prouver : on refuse plutôt que de
  // faire confiance à la query.
  if (!appId || !privateKey) return res.status(503).json({ error: "server not configured" });

  // L'installation_id arrive par l'URL et les ids sont séquentiels : sans cette
  // vérification, n'importe qui pourrait rattacher l'installation d'un autre à
  // sa propre session et récupérer les langages de ses repos privés.
  let account;
  try {
    account = await getInstallationAccount(installationId, { appId, privateKey, fetchImpl });
  } catch {
    return res.status(502).json({ error: "installation lookup failed" });
  }
  if (!account.login || account.login.toLowerCase() !== sess.login.toLowerCase()) {
    // Une installation d'organisation n'est pas rattachable : prouver
    // l'appartenance demanderait le token OAuth de l'utilisateur (non stocké).
    // Retour navigateur (GitHub nous y renvoie) : on repasse par la landing avec
    // un motif lisible plutôt que d'afficher du JSON brut.
    const org = account.type === "Organization";
    res.setHeader("Location", "/?app_error=" + (org ? "org" : "foreign"));
    return res.status(403).end();
  }

  await store.set("installation:" + sess.login, String(installationId));
  res.setHeader("Location", "/?connected=1");
  return res.status(302).end();
}

export default handler;
