import unittest
from datetime import datetime, timezone

from gitwrapped.analyze import analyze
from gitwrapped.collect import Commit


def commit(when: datetime, subject="msg", repo="r", added=0, deleted=0,
           files=None, email="me@e.com") -> Commit:
    return Commit("h", "Me", email, when, subject, repo, added, deleted, files or [])


def dt(y, m, d, h=12) -> datetime:
    return datetime(y, m, d, h, tzinfo=timezone.utc).astimezone()


class AnalyzeTest(unittest.TestCase):
    def test_empty_flag_when_no_commits(self) -> None:
        stats = analyze([], 2026)
        self.assertTrue(stats["empty"])
        self.assertEqual(stats["total_commits"], 0)
        self.assertEqual(stats["year"], 2026)

    def test_volume_totals(self) -> None:
        commits = [
            commit(dt(2026, 1, 1), added=10, deleted=3),
            commit(dt(2026, 1, 2), added=5, deleted=1),
        ]
        vol = analyze(commits, 2026)["volume"]
        self.assertEqual(vol["added"], 15)
        self.assertEqual(vol["deleted"], 4)
        self.assertEqual(analyze(commits, 2026)["total_commits"], 2)

    def test_longest_streak(self) -> None:
        commits = [
            commit(dt(2026, 3, 1)),
            commit(dt(2026, 3, 2)),
            commit(dt(2026, 3, 3)),
            commit(dt(2026, 3, 5)),  # trou le 4 -> reset
        ]
        self.assertEqual(analyze(commits, 2026)["volume"]["longest_streak"], 3)

    def test_busiest_day(self) -> None:
        commits = [
            commit(dt(2026, 4, 10)),
            commit(dt(2026, 4, 10)),
            commit(dt(2026, 4, 11)),
        ]
        busiest = analyze(commits, 2026)["volume"]["busiest_day"]
        self.assertEqual(busiest["date"], "2026-04-10")
        self.assertEqual(busiest["count"], 2)

    def test_rhythm_heatmap_shape_and_peak(self) -> None:
        # Deux commits un lundi à 2h locale.
        c = commit(datetime(2026, 6, 15, 2, 0).astimezone())  # 15/06/2026 = lundi
        stats = analyze([c, c], 2026)["rhythm"]
        self.assertEqual(len(stats["heatmap"]), 7)
        self.assertEqual(len(stats["heatmap"][0]), 24)
        self.assertEqual(stats["heatmap"][0][2], 2)  # lundi (index 0), 2h
        self.assertEqual(stats["peak_hour"], 2)

    def test_night_owl_score(self) -> None:
        night = commit(datetime(2026, 1, 1, 3, 0).astimezone())  # 3h -> nuit
        day = commit(datetime(2026, 1, 2, 14, 0).astimezone())   # 14h -> jour
        score = analyze([night, day], 2026)["rhythm"]["night_owl_pct"]
        self.assertEqual(score, 50)

    def test_projects_top_repo_and_top_file(self) -> None:
        commits = [
            commit(dt(2026, 1, 1), repo="alpha", files=["a.py"]),
            commit(dt(2026, 1, 2), repo="alpha", files=["a.py"]),
            commit(dt(2026, 1, 3), repo="beta", files=["b.js"]),
        ]
        proj = analyze(commits, 2026)["projects"]
        self.assertEqual(proj["top_repos"][0], {"name": "alpha", "count": 2})
        self.assertEqual(proj["top_file"], {"path": "a.py", "count": 2})
        langs = dict((l["ext"], l["count"]) for l in proj["languages"])
        self.assertEqual(langs[".py"], 2)
        self.assertEqual(langs[".js"], 1)

    def test_projects_languages_exclude_dotfiles(self) -> None:
        commits = [
            commit(dt(2026, 1, 1), files=[
                "app.py", "src/main.js", ".gitignore", "src/.env", "Makefile",
            ]),
        ]
        proj = analyze(commits, 2026)["projects"]
        exts = {l["ext"] for l in proj["languages"]}
        self.assertIn(".py", exts)
        self.assertIn(".js", exts)
        self.assertNotIn(".gitignore", exts)
        self.assertNotIn(".env", exts)
        self.assertFalse(any(e.startswith(".") and e[1:] in {"gitignore", "env"} for e in exts))

    def test_words_top_and_fix_rate(self) -> None:
        commits = [
            commit(dt(2026, 1, 1), subject="fix login bug"),
            commit(dt(2026, 1, 2), subject="fix logout bug"),
            commit(dt(2026, 1, 3), subject="add feature"),
        ]
        words = analyze(commits, 2026)["words"]
        top = dict((w["word"], w["count"]) for w in words["top_words"])
        self.assertEqual(top["bug"], 2)
        self.assertEqual(words["fix_rate_pct"], 67)  # 2/3 arrondi
        self.assertNotIn("the", top)  # stop-word filtré si présent

    def test_words_split_on_symbol_range(self) -> None:
        commits = [commit(dt(2026, 1, 1), subject="more÷text bug")]
        words = analyze(commits, 2026)["words"]
        top = {w["word"] for w in words["top_words"]}
        self.assertIn("more", top)
        self.assertIn("text", top)
        self.assertIn("bug", top)
        self.assertNotIn("more÷text", top)

    def test_projects_repo_count(self) -> None:
        commits = [
            commit(dt(2026, 1, 1), repo="alpha"),
            commit(dt(2026, 1, 2), repo="beta"),
            commit(dt(2026, 1, 3), repo="beta"),
        ]
        self.assertEqual(analyze(commits, 2026)["projects"]["repo_count"], 2)


class ArchetypeTest(unittest.TestCase):
    def test_night_owl_pompier(self) -> None:
        commits = [commit(datetime(2026, 1, 1, 3).astimezone(), subject="fix " + str(i))
                   for i in range(5)]
        arch = analyze(commits, 2026)["archetype"]
        self.assertEqual(arch["title"], "Night Owl Pompier")
        self.assertTrue(arch["tagline"])
        self.assertIn("100% la nuit", arch["traits"])

    def test_builder_when_more_added_than_deleted(self) -> None:
        commits = [commit(dt(2026, 1, 1, 14), subject="add feature", added=50, deleted=1)]
        arch = analyze(commits, 2026)["archetype"]
        self.assertIn("Bâtisseur", arch["title"])

    def test_empty_year_has_no_archetype(self) -> None:
        self.assertEqual(analyze([], 2026)["archetype"], {})


class ContributionsTest(unittest.TestCase):
    def test_grid_is_weeks_of_seven_days(self) -> None:
        contrib = analyze([commit(dt(2026, 6, 15))], 2026)["contributions"]
        self.assertTrue(all(len(week) == 7 for week in contrib["weeks"]))
        # 2026 spans 53 grid columns (Sunday-aligned).
        self.assertEqual(len(contrib["weeks"]), 53)

    def test_counts_land_on_the_right_day(self) -> None:
        commits = [commit(dt(2026, 6, 15)), commit(dt(2026, 6, 15))]
        contrib = analyze(commits, 2026)["contributions"]
        cells = [c for week in contrib["weeks"] for c in week if c is not None]
        target = next(c for c in cells if c["date"] == "2026-06-15")
        self.assertEqual(target["count"], 2)
        self.assertEqual(contrib["max"], 2)

    def test_days_outside_year_are_none(self) -> None:
        contrib = analyze([commit(dt(2026, 6, 15))], 2026)["contributions"]
        dates = [c["date"] for week in contrib["weeks"] for c in week if c is not None]
        self.assertTrue(all(d.startswith("2026-") for d in dates))
        # Grid starts before Jan 1, so the first column holds padding None cells.
        self.assertIsNone(contrib["weeks"][0][0])

    def test_empty_year_still_has_grid(self) -> None:
        contrib = analyze([], 2026)["contributions"]
        self.assertEqual(contrib["max"], 0)
        self.assertTrue(all(len(week) == 7 for week in contrib["weeks"]))


if __name__ == "__main__":
    unittest.main()
