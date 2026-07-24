import { filterWindow, devScore, repoScore } from "./score.js";

const WINDOWS = ["week", "year"];

function devList(participants, window, now, year) {
  return participants
    .map((p) => {
      const commits = filterWindow(p.commits, window, now, year);
      const { score, detail } = devScore(commits);
      return { login: p.login, avatar: p.avatar, score, detail, wrappedUrl: "/?u=" + p.login };
    })
    .sort((a, b) => b.score - a.score);
}

function repoList(participants, window, now, year) {
  const byRepo = new Map(); // key "owner/repo" -> commits[]
  for (const p of participants) {
    for (const c of filterWindow(p.commits, window, now, year)) {
      const key = c.owner + "/" + c.repo;
      if (!byRepo.has(key)) byRepo.set(key, []);
      byRepo.get(key).push(c);
    }
  }
  return [...byRepo.values()]
    .map((commits) => {
      const { score, detail } = repoScore(commits);
      return { repo: commits[0].repo, owner: commits[0].owner, score, detail };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildSnapshot(participants, now, year) {
  const devs = {}, repos = {};
  for (const w of WINDOWS) {
    devs[w] = devList(participants, w, now, year);
    repos[w] = repoList(participants, w, now, year);
  }
  return { updatedAt: new Date(now).toISOString(), devs, repos };
}
