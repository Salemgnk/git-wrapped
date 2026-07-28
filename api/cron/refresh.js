import { kv } from "../../lib/kv.js";
import { fetchWrapped as realFetchWrapped } from "../../lib/github-client.js";
import { buildSnapshot } from "../../lib/rank.js";

function config(opts) {
  return {
    fetchWrapped: opts.fetchWrapped || realFetchWrapped,
    token: opts.token ?? process.env.GITHUB_TOKEN,
    fetchImpl: opts.fetchImpl || fetch,
    year: opts.year || new Date().getUTCFullYear(),
  };
}

// Récupère + normalise les commits d'un participant : uniquement ses repos
// possédés (owner === login), publics (le fetch exclut déjà les privés).
async function fetchParticipant(login, cfg) {
  const data = await cfg.fetchWrapped(login, cfg.year, cfg.token, cfg.fetchImpl);
  const ownerByRepo = new Map((data.reposByCommits || []).map((r) => [r.name, r.owner]));
  const commits = (data.commits || [])
    .map((c) => ({
      repo: c.repo, owner: ownerByRepo.get(c.repo) || login,
      committedDate: c.committedDate, additions: c.additions, deletions: c.deletions,
    }))
    .filter((c) => c.owner.toLowerCase() === login.toLowerCase());
  return { login, avatar: data.avatar || null, commits };
}

// Reconstruit le snapshot depuis les parts stockées en KV (rapide, sans réseau).
async function rebuild(store, now, year) {
  const logins = await store.smembers("participants");
  const participants = [];
  for (const login of logins) {
    const p = await store.get("part:" + login);
    participants.push(p && p.commits ? p : { login, avatar: null, commits: [] });
  }
  const snapshot = buildSnapshot(participants, now, year);
  await store.set("snapshot", snapshot);
  return snapshot;
}

// Refresh complet : refetch tous les participants, stocke chaque part, reconstruit.
export async function refresh(opts = {}) {
  const store = opts.kv || kv();
  const now = opts.now || Date.now();
  const cfg = config(opts);
  const logins = await store.smembers("participants");
  let degraded = false;
  for (const login of logins) {
    try {
      await store.set("part:" + login, await fetchParticipant(login, cfg));
      await store.set("failcount:" + login, 0);
    } catch (e) {
      if (e && e.code === 404) {
        const n = ((await store.get("failcount:" + login)) || 0) + 1;
        if (n >= 5) { await store.srem("participants", login); await store.set("part:" + login, null); }
        else await store.set("failcount:" + login, n);
      } else {
        degraded = true; // rate limit / réseau : on ne reconstruit pas
      }
    }
  }
  if (degraded) return { skipped: true, reason: "degraded" };
  const snap = await rebuild(store, now, cfg.year);
  return { ok: true, count: (await store.smembers("participants")).length, updatedAt: snap.updatedAt };
}

// Refresh d'un seul participant (léger) puis reconstruction depuis le store.
export async function refreshOne(login, opts = {}) {
  const store = opts.kv || kv();
  const now = opts.now || Date.now();
  const cfg = config(opts);
  try {
    await store.set("part:" + login, await fetchParticipant(login, cfg));
    await store.set("failcount:" + login, 0);
  } catch (e) {
    return { skipped: true, reason: e && e.code === 404 ? "not_found" : "degraded" };
  }
  const snap = await rebuild(store, now, cfg.year);
  return { ok: true, one: login, updatedAt: snap.updatedAt };
}

export async function handler(req, res, opts = {}) {
  const secret = opts.cronSecret ?? process.env.CRON_SECRET;
  if (!secret || (req.headers?.authorization || "") !== "Bearer " + secret)
    return res.status(401).json({ error: "unauthorized" });
  return res.status(200).json(await refresh(opts));
}

export default handler;
