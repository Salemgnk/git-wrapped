import { fetchWrapped } from "./github-client.js";
import { githubToStats } from "./github-to-stats.js";

const USER_RE = /^[a-zA-Z0-9-]{1,39}$/;

export async function handler(req, res, opts = {}) {
  const token = opts.token !== undefined ? opts.token : process.env.GITHUB_TOKEN;
  const fetchImpl = opts.fetchImpl || fetch;
  const user = (req.query && req.query.user || "").trim();
  const year = +(req.query && req.query.year) || new Date().getFullYear();
  if (!USER_RE.test(user)) return res.status(400).json({ error: "invalid username" });
  if (!token) return res.status(503).json({ error: "server not configured" });
  try {
    const input = await fetchWrapped(user, year, token, fetchImpl);
    const stats = githubToStats(input);
    res.setHeader("Cache-Control", "public, max-age=600");
    return res.status(200).json(stats);
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: "user not found" });
    return res.status(503).json({ error: "upstream error" });
  }
}

export default handler;
