import { fetchWrapped as realFetchWrapped } from "../lib/github-client.js";
import { githubToStats } from "../lib/github-to-stats.js";

const USER_RE = /^[a-zA-Z0-9-]{1,39}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Période depuis la query : { from, to } si les deux sont des dates ISO valides,
// sinon l'année (year=... ou année courante) — rétro-compatible.
export function periodFromQuery(q = {}) {
  if (DATE_RE.test(q.from || "") && DATE_RE.test(q.to || "") && q.from <= q.to)
    return { from: q.from, to: q.to };
  return +q.year || new Date().getFullYear();
}

export async function handler(req, res, opts = {}) {
  const token = opts.token !== undefined ? opts.token : process.env.GITHUB_TOKEN;
  const fetchImpl = opts.fetchImpl || fetch;
  const fetchWrapped = opts.fetchWrapped || realFetchWrapped;
  const user = (req.query && req.query.user || "").trim();
  const period = periodFromQuery(req.query);
  if (!USER_RE.test(user)) return res.status(400).json({ error: "invalid username" });
  if (!token) return res.status(503).json({ error: "server not configured" });
  try {
    const input = await fetchWrapped(user, period, token, fetchImpl);
    const stats = githubToStats(input);
    res.setHeader("Cache-Control", "public, max-age=600");
    return res.status(200).json(stats);
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: "user not found" });
    return res.status(503).json({ error: "upstream error" });
  }
}

export default handler;
