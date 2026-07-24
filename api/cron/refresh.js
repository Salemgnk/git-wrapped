import { kv } from "../../lib/kv.js";
import { fetchWrapped as realFetchWrapped } from "../../lib/github-client.js";
import { buildSnapshot } from "../../lib/rank.js";

export async function handler(req, res, opts = {}) {
  const secret = opts.cronSecret ?? process.env.CRON_SECRET;
  if (!secret || (req.headers?.authorization || "") !== "Bearer " + secret)
    return res.status(401).json({ error: "unauthorized" });

  const store = opts.kv || kv();
  const fetchWrapped = opts.fetchWrapped || realFetchWrapped;
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  const fetchImpl = opts.fetchImpl || fetch;
  const year = opts.year || new Date().getUTCFullYear();
  const now = opts.now || Date.now();

  const logins = await store.smembers("participants");
  const participants = [];
  let degraded = false;

  for (const login of logins) {
    try {
      const data = await fetchWrapped(login, year, token, fetchImpl);
      const ownerByRepo = new Map((data.reposByCommits || []).map((r) => [r.name, r.owner]));
      const commits = (data.commits || []).map((c) => ({
        repo: c.repo, owner: ownerByRepo.get(c.repo) || login,
        committedDate: c.committedDate, additions: c.additions, deletions: c.deletions,
      }));
      participants.push({ login, avatar: data.avatar || null, commits });
      await store.set("failcount:" + login, 0);
    } catch (e) {
      if (e && e.code === 404) {
        const n = ((await store.get("failcount:" + login)) || 0) + 1;
        if (n >= 5) await store.srem("participants", login);
        else { await store.set("failcount:" + login, n); participants.push({ login, avatar: null, commits: [] }); }
      } else {
        degraded = true; // rate limit / réseau : on ne veut pas écraser avec des données partielles
      }
    }
  }

  if (degraded) return res.status(200).json({ skipped: true, reason: "degraded" });

  const snapshot = buildSnapshot(participants, now, year);
  await store.set("snapshot", snapshot);
  return res.status(200).json({ ok: true, count: participants.length, updatedAt: snapshot.updatedAt });
}
export default handler;
