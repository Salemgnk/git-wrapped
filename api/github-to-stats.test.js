import { test } from "node:test";
import assert from "node:assert/strict";
import { githubToStats } from "./github-to-stats.js";

function cal(year, entries) {
  // entries: {"YYYY-MM-DD": count}. On remplit une année de zéros puis on applique.
  const days = [];
  const d = new Date(Date.UTC(year, 0, 1)), end = new Date(Date.UTC(year, 11, 31));
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, count: entries[iso] || 0 });
  }
  return days;
}

test("empty when no commits", () => {
  const s = githubToStats({ user: "x", year: 2026, calendar: cal(2026, {}),
    reposByCommits: [], commits: [], languages: [] });
  assert.equal(s.empty, true);
  assert.equal(s.total_commits, 0);
  assert.equal(s.year, 2026);
  assert.equal(s.projects.top_file, null);
});

test("volume, streak, busiest day from calendar", () => {
  const s = githubToStats({ user: "x", year: 2026,
    calendar: cal(2026, { "2026-03-02": 3, "2026-03-03": 1, "2026-03-04": 2, "2026-03-06": 5 }),
    reposByCommits: [{ name: "a", count: 11 }],
    commits: [{ repo: "a", committedDate: "2026-03-02T02:00:00Z", message: "feat x",
      additions: 10, deletions: 3 }],
    languages: [{ ext: ".js", count: 100 }] });
  assert.equal(s.total_commits, 11);            // depuis le calendrier
  assert.equal(s.volume.longest_streak, 3);      // 2,3,4 mars consécutifs
  assert.deepEqual(s.volume.busiest_day, { date: "2026-03-06", count: 5 });
  assert.equal(s.volume.active_days, 4);
});

test("rhythm/words/lines from commit histories", () => {
  const s = githubToStats({ user: "x", year: 2026, calendar: cal(2026, { "2026-01-01": 2 }),
    reposByCommits: [{ name: "a", count: 2 }],
    commits: [
      { repo: "a", committedDate: "2026-01-01T03:00:00Z", message: "fix login bug",
        additions: 5, deletions: 1 },
      { repo: "a", committedDate: "2026-01-01T14:00:00Z", message: "fix logout bug",
        additions: 4, deletions: 2 }],
    languages: [{ ext: ".ts", count: 50 }, { ext: ".tsx", count: 30 }] });
  assert.equal(s.volume.added, 9);
  assert.equal(s.volume.deleted, 3);
  assert.equal(s.rhythm.night_owl_pct, 50);      // 1 commit à 3h sur 2
  assert.equal(s.words.fix_rate_pct, 100);
  const words = Object.fromEntries(s.words.top_words.map(w => [w.word, w.count]));
  assert.equal(words.bug, 2);
});

test("top repos and language aggregation by name", () => {
  const s = githubToStats({ user: "x", year: 2026, calendar: cal(2026, { "2026-01-01": 3 }),
    reposByCommits: [{ name: "alpha", count: 30 }, { name: "beta", count: 10 }],
    commits: [{ repo: "alpha", committedDate: "2026-01-01T10:00:00Z", message: "add",
      additions: 1, deletions: 0 }],
    languages: [{ ext: ".ts", count: 100 }, { ext: ".tsx", count: 50 }, { ext: ".map", count: 999 }] });
  assert.deepEqual(s.projects.top_repos[0], { name: "alpha", count: 30 });
  assert.equal(s.projects.repo_count, 2);
  const langs = Object.fromEntries(s.projects.languages.map(l => [l.ext, l.count]));
  assert.equal(langs[".ts"], 100);   // langages restent au format ext ; l'agrégation par NOM se fait au rendu
  assert.equal(langs[".map"], 999);  // githubToStats ne filtre pas ; le filtrage .map se fait côté rendu
});
