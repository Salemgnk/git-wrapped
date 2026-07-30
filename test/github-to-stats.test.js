import { test } from "node:test";
import assert from "node:assert/strict";
import { githubToStats, periodBounds, mergeWrappedInputs } from "../lib/github-to-stats.js";

// c(date, hour, msg, add, del, repo) -> objet d'historique de commit
function c(date, hour = 12, message = "msg", additions = 0, deletions = 0, repo = "a") {
  return { repo, committedDate: date + "T" + String(hour).padStart(2, "0") + ":00:00Z",
    message, additions, deletions };
}

test("empty when no commits", () => {
  const s = githubToStats({ user: "x", year: 2026, commits: [], languages: [] });
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
  const s = githubToStats({ user: "x", year: 2026, commits, languages: [{ ext: ".js", count: 100 }] });
  assert.equal(s.total_commits, 8);              // = commits.length
  assert.equal(s.volume.longest_streak, 3);      // 2,3,4 mars consécutifs
  assert.deepEqual(s.volume.busiest_day, { date: "2026-03-06", count: 5 });
  assert.equal(s.volume.active_days, 4);
  assert.equal(s.volume.added, 10);
  assert.equal(s.volume.deleted, 3);
});

test("rhythm/words from commits", () => {
  const s = githubToStats({ user: "x", year: 2026,
    commits: [c("2026-01-01", 3, "fix login bug", 5, 1),
              c("2026-01-01", 14, "fix logout bug", 4, 2)],
    languages: [{ ext: ".ts", count: 50 }] });
  assert.equal(s.volume.added, 9);
  assert.equal(s.rhythm.night_owl_pct, 50);      // 1 commit à 3h sur 2
  assert.equal(s.words.fix_rate_pct, 100);
  const words = Object.fromEntries(s.words.top_words.map(w => [w.word, w.count]));
  assert.equal(words.bug, 2);
});

test("top repos derived from the commits (single source of truth)", () => {
  const s = githubToStats({ user: "x", year: 2026,
    commits: [
      c("2026-01-01", 10, "add", 1, 0, "alpha"),
      c("2026-01-02", 10, "add", 1, 0, "alpha"),
      c("2026-01-03", 10, "add", 1, 0, "alpha"),
      c("2026-01-04", 10, "add", 1, 0, "beta")],
    languages: [{ ext: ".ts", count: 100 }, { ext: ".map", count: 999 }] });
  assert.deepEqual(s.projects.top_repos[0], { name: "alpha", count: 3 });
  assert.equal(s.projects.repo_count, 2);
  assert.equal(s.total_commits, 4);              // cohérent : total == somme des repos
  const langs = Object.fromEntries(s.projects.languages.map(l => [l.ext, l.count]));
  assert.equal(langs[".map"], 999);
});

test("periodBounds: from/to prioritaires sur year", () => {
  assert.deepEqual(periodBounds({ from: "2025-06-01", to: "2025-08-31", year: 2026 }),
    { from: "2025-06-01", to: "2025-08-31" });
});

test("periodBounds: derive depuis year", () => {
  assert.deepEqual(periodBounds({ year: 2024 }), { from: "2024-01-01", to: "2024-12-31" });
});

test("stats sur une période custom < 1 an ne compte que la fenêtre", () => {
  const commits = [c("2026-02-10"), c("2026-02-11"), c("2026-09-01")];
  const s = githubToStats({ user: "x", from: "2026-01-01", to: "2026-03-31", commits, languages: [] });
  // Le calendrier ne couvre que jan->mars : le commit de septembre n'a pas de case.
  const dates = s.contributions.weeks.flat().filter(Boolean).map(d => d.date);
  assert.ok(dates.includes("2026-02-10"));
  assert.ok(!dates.some(d => d.startsWith("2026-09")));
  assert.equal(s.period.from, "2026-01-01");
  assert.equal(s.period.to, "2026-03-31");
});

test("période à cheval sur deux années : year = année de 'to'", () => {
  const s = githubToStats({ user: "x", from: "2025-11-01", to: "2026-01-31",
    commits: [c("2025-12-25"), c("2026-01-05")], languages: [] });
  assert.equal(s.year, 2026);
  assert.equal(s.total_commits, 2);
});

test("mergeWrappedInputs concatène commits et agrège langages", () => {
  const a = { commits: [c("2026-01-01")], languages: [{ ext: ".js", count: 10 }, { ext: ".ts", count: 5 }] };
  const b = { commits: [c("2026-01-02")], languages: [{ ext: ".js", count: 3 }] };
  const m = mergeWrappedInputs(a, b);
  assert.equal(m.commits.length, 2);
  const byExt = Object.fromEntries(m.languages.map(l => [l.ext, l.count]));
  assert.deepEqual(byExt, { ".js": 13, ".ts": 5 });
});
