import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../lib/rank.js";

const NOW = Date.UTC(2026, 5, 15, 12);
function c(date, add, repo, owner) {
  return { repo, owner, committedDate: date + "T10:00:00Z", additions: add, deletions: 0 };
}

test("buildSnapshot: classe devs et repos, semaine et année", () => {
  const participants = [
    { login: "alice", avatar: "a.png", commits: [c("2026-06-14", 5, "app", "alice"), c("2026-06-13", 5, "app", "alice")] },
    { login: "bob", avatar: "b.png", commits: [c("2026-06-14", 5, "app", "alice")] }, // bob a poussé sur le repo d'alice
    { login: "old", avatar: "o.png", commits: [c("2026-01-01", 99, "legacy", "old")] }, // hors semaine
  ];
  const s = buildSnapshot(participants, NOW, 2026);
  assert.equal(s.devs.week[0].login, "alice");        // alice devant (2 jours actifs)
  // old n'a rien poussé cette semaine -> présent mais score 0, relégué en bas
  assert.equal(s.devs.week.find((d) => d.login === "old").score, 0);
  assert.equal(s.devs.week[s.devs.week.length - 1].login, "old");
  assert.equal(s.devs.year.find((d) => d.login === "old").score > 0, true);
  assert.equal(s.devs.week[0].wrappedUrl, "/?u=alice");
  // repo "alice/app" agrège alice + bob cette semaine
  const app = s.repos.week.find((r) => r.owner === "alice" && r.repo === "app");
  assert.equal(app.detail.commits, 3);
  assert.ok(s.updatedAt);
});

test("buildSnapshot: participant sans commits -> score 0 en année", () => {
  const s = buildSnapshot([{ login: "empty", avatar: null, commits: [] }], NOW, 2026);
  assert.equal(s.devs.year[0].score, 0);
});
