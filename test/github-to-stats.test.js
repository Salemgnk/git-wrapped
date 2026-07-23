import { test } from "node:test";
import assert from "node:assert/strict";
import { githubToStats } from "../lib/github-to-stats.js";

// commit(date, hour, msg, add, del) -> objet d'historique
function c(date, hour = 12, message = "msg", additions = 0, deletions = 0) {
  return { committedDate: date + "T" + String(hour).padStart(2, "0") + ":00:00Z",
    message, additions, deletions };
}

test("empty when no commits", () => {
  const s = githubToStats({ user: "x", year: 2026, reposByCommits: [], commits: [], languages: [] });
  assert.equal(s.empty, true);
  assert.equal(s.total_commits, 0);
  assert.equal(s.year, 2026);
  assert.equal(s.projects.top_file, null);
});

test("volume, streak, busiest day from public commits", () => {
  const commits = [
    c("2026-03-02", 2, "feat x", 10, 3),
    c("2026-03-03"), c("2026-03-04"),
    c("2026-03-06"), c("2026-03-06"), c("2026-03-06"), c("2026-03-06"), c("2026-03-06")];
  const s = githubToStats({ user: "x", year: 2026,
    reposByCommits: [{ name: "a", count: 8 }], commits, languages: [{ ext: ".js", count: 100 }] });
  assert.equal(s.total_commits, 8);              // = commits.length
  assert.equal(s.volume.longest_streak, 3);      // 2,3,4 mars consécutifs
  assert.deepEqual(s.volume.busiest_day, { date: "2026-03-06", count: 5 });
  assert.equal(s.volume.active_days, 4);
  assert.equal(s.volume.added, 10);
  assert.equal(s.volume.deleted, 3);
});

test("rhythm/words from commits", () => {
  const s = githubToStats({ user: "x", year: 2026,
    reposByCommits: [{ name: "a", count: 2 }],
    commits: [c("2026-01-01", 3, "fix login bug", 5, 1),
              c("2026-01-01", 14, "fix logout bug", 4, 2)],
    languages: [{ ext: ".ts", count: 50 }] });
  assert.equal(s.volume.added, 9);
  assert.equal(s.rhythm.night_owl_pct, 50);      // 1 commit à 3h sur 2
  assert.equal(s.words.fix_rate_pct, 100);
  const words = Object.fromEntries(s.words.top_words.map(w => [w.word, w.count]));
  assert.equal(words.bug, 2);
});

test("top repos and languages (raw ext, aggregation happens at render)", () => {
  const s = githubToStats({ user: "x", year: 2026,
    reposByCommits: [{ name: "alpha", count: 30 }, { name: "beta", count: 10 }],
    commits: [c("2026-01-01", 10, "add", 1, 0)],
    languages: [{ ext: ".ts", count: 100 }, { ext: ".tsx", count: 50 }, { ext: ".map", count: 999 }] });
  assert.deepEqual(s.projects.top_repos[0], { name: "alpha", count: 30 });
  assert.equal(s.projects.repo_count, 2);
  const langs = Object.fromEntries(s.projects.languages.map(l => [l.ext, l.count]));
  assert.equal(langs[".ts"], 100);
  assert.equal(langs[".map"], 999);
});
