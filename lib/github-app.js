import crypto from "node:crypto";

const API = "https://api.github.com";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const H = (auth) => ({ Authorization: auth, Accept: "application/vnd.github+json", "User-Agent": "git-wrapped" });

// JWT RS256 signé par la clé privée de la GitHub App (courte durée, ~9 min).
export function appJwt(appId, privateKey, now = Date.now()) {
  const iat = Math.floor(now / 1000) - 30, exp = iat + 540;
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iat, exp, iss: String(appId) });
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + body).sign(privateKey, "base64url");
  return head + "." + body + "." + sig;
}

// Échange le JWT contre un installation token (~1 h) pour une installation donnée.
export async function mintInstallationToken(installationId, { appId, privateKey, fetchImpl = fetch, now } = {}) {
  const jwt = appJwt(appId, privateKey, now);
  const r = await fetchImpl(API + "/app/installations/" + installationId + "/access_tokens",
    { method: "POST", headers: H("Bearer " + jwt) });
  if (!r.ok) throw new Error("app token http " + r.status);
  const j = await r.json();
  if (!j.token) throw new Error("app token missing");
  return j.token;
}

// Repos couverts par l'installation (paginé). Ne retourne que les privés
// (les publics sont déjà couverts par le chemin public).
export async function listInstallationRepos(token, { fetchImpl = fetch } = {}) {
  const out = []; let page = 1;
  for (;;) {
    const r = await fetchImpl(API + "/installation/repositories?per_page=100&page=" + page,
      { headers: H("Bearer " + token) });
    if (!r.ok) throw new Error("install repos http " + r.status);
    const repos = (await r.json()).repositories || [];
    for (const rp of repos) out.push({ owner: rp.owner.login, name: rp.name, isPrivate: rp.private });
    if (repos.length < 100) break;
    page++;
  }
  return out.filter((r) => r.isPrivate);
}

// Compte propriétaire d'une installation ({ login, type }), via JWT d'app.
// Sert à prouver qu'un installation_id reçu en query appartient bien à
// l'utilisateur connecté, au lieu de le croire sur parole.
export async function getInstallationAccount(installationId, { appId, privateKey, fetchImpl = fetch, now } = {}) {
  const jwt = appJwt(appId, privateKey, now);
  const r = await fetchImpl(API + "/app/installations/" + encodeURIComponent(installationId),
    { headers: H("Bearer " + jwt) });
  if (!r.ok) throw new Error("installation lookup http " + r.status);
  const acc = (await r.json()).account || {};
  return { login: acc.login || null, type: acc.type || null };
}
