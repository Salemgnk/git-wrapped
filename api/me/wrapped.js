import { fetchWrapped, fetchPrivateCommits } from "../../lib/github-client.js";
import { githubToStats, mergeWrappedInputs } from "../../lib/github-to-stats.js";
import { mintInstallationToken, listInstallationRepos } from "../../lib/github-app.js";
import { verifySession, parseCookies } from "../../lib/session.js";
import { kv } from "../../lib/kv.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function periodFromQuery(q = {}) {
  if (DATE_RE.test(q.from || "") && DATE_RE.test(q.to || "") && q.from <= q.to)
    return { from: q.from, to: q.to };
  return +q.year || new Date().getUTCFullYear();
}

export async function handler(req, res, opts = {}) {
  const store = opts.kv || kv();
  const token = opts.token !== undefined ? opts.token : process.env.GITHUB_TOKEN;
  const fetchImpl = opts.fetchImpl || fetch;
  const secret = opts.secret ?? process.env.SESSION_SECRET;
  const appId = opts.appId ?? process.env.GH_APP_ID;
  const privateKey = opts.privateKey ?? process.env.GH_APP_PRIVATE_KEY;

  const sess = secret ? verifySession(parseCookies(req.headers?.cookie).gw_session, secret) : null;
  if (!sess || !sess.login) return res.status(401).json({ error: "auth required" });
  if (!token) return res.status(503).json({ error: "server not configured" });
  const login = sess.login;
  const period = periodFromQuery(req.query);

  try {
    const pub = await fetchWrapped(login, period, token, fetchImpl);
    let priv = { commits: [], languages: [], reposByCommits: [] };
    let privateIncluded = false;
    const installationId = await store.get("installation:" + login);
    if (installationId && appId && privateKey) {
      const instTok = await mintInstallationToken(installationId, { appId, privateKey, fetchImpl });
      const repos = await listInstallationRepos(instTok, { fetchImpl });
      if (repos.length) {
        priv = await fetchPrivateCommits({ userId: pub.id, repos,
          period: { from: pub.from, to: pub.to }, token: instTok, fetchImpl });
        privateIncluded = true;
      }
    }
    const merged = mergeWrappedInputs(pub, priv);
    const stats = githubToStats({ user: login, from: pub.from, to: pub.to,
      commits: merged.commits, languages: merged.languages });
    stats.private_included = privateIncluded;
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(stats);
  } catch (e) {
    return res.status(503).json({ error: "upstream error" });
  }
}

export default handler;
