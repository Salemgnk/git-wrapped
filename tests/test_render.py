import tempfile
import unittest
from pathlib import Path

from gitwrapped.render import render


class RenderTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name) / "wrapped.html"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _stats(self, empty=False) -> dict:
        contributions = {
            "weeks": [[{"date": "2026-01-04", "count": 1}] + [None] * 6],
            "max": 1,
            "month_labels": [{"col": 0, "label": "Jan"}],
        }
        if empty:
            return {"year": 2026, "total_commits": 0, "empty": True,
                    "volume": {}, "rhythm": {}, "projects": {}, "words": {},
                    "contributions": contributions, "archetype": {}}
        return {
            "year": 2026, "total_commits": 42, "empty": False,
            "volume": {"added": 100, "deleted": 20, "longest_streak": 5,
                       "busiest_day": {"date": "2026-04-10", "count": 7},
                       "active_days": 30},
            "rhythm": {"heatmap": [[0] * 24 for _ in range(7)], "peak_hour": 2,
                       "peak_weekday": 0, "night_owl_pct": 60},
            "projects": {"top_repos": [{"name": "alpha", "count": 10}],
                         "repo_count": 3,
                         "top_file": {"path": "a.py", "count": 8},
                         "languages": [{"ext": ".py", "count": 20}]},
            "words": {"top_words": [{"word": "bug", "count": 5}],
                      "fix_rate_pct": 40, "longest_subject": "refactor everything",
                      "emojis": []},
            "contributions": contributions,
            "archetype": {"title": "Night Owl Bâtisseur",
                          "tagline": "brique par brique",
                          "traits": ["60% la nuit", "fix 40%", ".py"]},
        }

    def test_writes_self_contained_html(self) -> None:
        render(self._stats(), self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertIn("<!DOCTYPE html>", html)
        self.assertIn("2026", html)
        # Aucune ressource externe.
        self.assertNotIn("<link ", html)
        self.assertNotIn("src=\"http", html)
        self.assertNotIn("href=\"http", html)

    def test_embeds_stats_json(self) -> None:
        render(self._stats(), self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertIn("42", html)  # total_commits présent quelque part

    def test_empty_year_renders_without_crash(self) -> None:
        render(self._stats(empty=True), self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertIn("2026", html)
        self.assertIn("silence radio", html)

    def test_escapes_html_in_strings(self) -> None:
        stats = self._stats()
        stats["words"]["longest_subject"] = "<script>alert(1)</script>"
        render(stats, self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertNotIn("<script>alert(1)</script>", html)

    def test_renders_emoji_card(self) -> None:
        stats = self._stats()
        stats["words"]["emojis"] = [{"emoji": "🔥", "count": 3}]
        render(stats, self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertIn("emojis", html)
        # Pas de crash quand la liste d'emojis est vide (cas par defaut).
        render(self._stats(), self.out)

    def test_renders_archetype_card(self) -> None:
        render(self._stats(), self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertIn("archetype", html)
        self.assertIn("Night Owl B", html)  # accent-insensitive check of title

    def test_fonts_embedded_as_base64(self) -> None:
        render(self._stats(), self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertIn("@font-face", html)
        self.assertIn("data:font/woff2;base64,", html)


if __name__ == "__main__":
    unittest.main()
