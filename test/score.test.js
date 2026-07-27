import { test } from "node:test";
import assert from "node:assert/strict";
import { filterWindow, devScore, repoScore } from "../lib/score.js";

const NOW = Date.UTC(2026, 5, 15, 12); // 2026-06-15
function c(date, add = 1, del = 0, repo = "a", owner = "me") {
  return { repo, owner, committedDate: date + "T10:00:00Z", additions: add, deletions: del };
}

test("filterWindow: exclut commits vides et hors fenêtre", () => {
  const commits = [c("2026-06-14"), c("2026-06-14", 0, 0), c("2026-01-01"), c("2025-12-31")];
  const week = filterWindow(commits, "week", NOW, 2026);
  assert.equal(week.length, 1);                 // seul 2026-06-14 non vide dans les 7j
  const year = filterWindow(commits, "year", NOW, 2026);
  assert.equal(year.length, 2);                 // 2026-06-14 + 2026-01-01 (vide et 2025 exclus)
});

test("devScore: commits bruts (pas de plafond), jours actifs, lignes plafonnées à 5000", () => {
  const commits = [];
  for (let i = 0; i < 60; i++) commits.push(c("2026-06-10", 10, 0, "big")); // pas de plafond
  commits.push(c("2026-06-11", 100, 100, "other"));
  const { score, detail } = devScore(commits);
  // commits = 61 ; jours = 2 ; lignes = min(60*10 + 200, 5000) = 800
  assert.equal(detail.commits, 61);
  assert.equal(detail.joursActifs, 2);
  assert.equal(detail.lignes, 800);
  assert.equal(score, 61 + 2 * 10 + Math.floor(800 / 100)); // 61 + 20 + 8 = 89
});

test("repoScore: pas de plafond commits, lignes plafonnées à 20000", () => {
  const commits = [];
  for (let i = 0; i < 100; i++) commits.push(c("2026-06-10", 300, 0, "r"));
  const { score, detail } = repoScore(commits);
  assert.equal(detail.commits, 100);            // pas de plafond
  assert.equal(detail.lignes, 20000);           // min(30000, 20000)
  assert.equal(score, 100 + 1 * 10 + 200);      // 100 + 10 + floor(20000/100)
});
