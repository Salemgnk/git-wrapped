import subprocess
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from gitwrapped.collect import Commit, collect_commits, parse_git_log

RS = "\x1e"
US = "\x1f"


class ParseGitLogTest(unittest.TestCase):
    def test_parses_single_commit_with_numstat(self) -> None:
        header = US.join(
            ["abc123", "Kossi", "k@example.com", "2026-03-04T02:30:00+00:00", "fix: bug"]
        )
        output = f"{RS}{header}\n5\t2\tapp.py\n3\t0\tREADME.md\n"
        commits = parse_git_log(output, "myrepo")
        self.assertEqual(len(commits), 1)
        c = commits[0]
        self.assertEqual(c.hash, "abc123")
        self.assertEqual(c.author_email, "k@example.com")
        self.assertEqual(c.subject, "fix: bug")
        self.assertEqual(c.repo, "myrepo")
        self.assertEqual(c.added, 8)
        self.assertEqual(c.deleted, 2)
        self.assertEqual(c.files, ["app.py", "README.md"])
        self.assertIsInstance(c.when, datetime)
        self.assertIsNotNone(c.when.tzinfo)

    def test_binary_numstat_dashes_count_as_zero(self) -> None:
        header = US.join(
            ["h", "N", "e@e.com", "2026-01-01T10:00:00+00:00", "add image"]
        )
        output = f"{RS}{header}\n-\t-\tlogo.png\n"
        commits = parse_git_log(output, "r")
        self.assertEqual(commits[0].added, 0)
        self.assertEqual(commits[0].deleted, 0)
        self.assertEqual(commits[0].files, ["logo.png"])

    def test_empty_output_returns_empty_list(self) -> None:
        self.assertEqual(parse_git_log("", "r"), [])

    def test_subject_with_field_separator_preserved(self) -> None:
        # Un %s ne contient normalement pas US, mais on ne doit pas casser.
        header = US.join(["h", "N", "e@e.com", "2026-01-01T10:00:00+00:00", "a"])
        output = f"{RS}{header}\n"
        commits = parse_git_log(output, "r")
        self.assertEqual(commits[0].subject, "a")


class CollectCommitsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        self._git("init", "-q")
        self._git("config", "user.email", "me@example.com")
        self._git("config", "user.name", "Me")
        (self.repo / "f.txt").write_text("hello\nworld\n")
        self._git("add", "f.txt")
        env_date = "2026-06-15T14:00:00"
        self._git(
            "commit", "-q", "-m", "first commit",
            env={"GIT_AUTHOR_DATE": env_date, "GIT_COMMITTER_DATE": env_date},
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _git(self, *args, env=None) -> None:
        base_env = {"GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null"}
        import os
        run_env = {**os.environ, **base_env, **(env or {})}
        subprocess.run(["git", *args], cwd=self.repo, check=True, env=run_env,
                       capture_output=True)

    def test_collects_commit_for_year(self) -> None:
        commits = collect_commits(self.repo, 2026, "me@example.com")
        self.assertEqual(len(commits), 1)
        self.assertEqual(commits[0].subject, "first commit")
        self.assertEqual(commits[0].repo, self.repo.name)

    def test_filters_out_other_year(self) -> None:
        self.assertEqual(collect_commits(self.repo, 2020, "me@example.com"), [])

    def test_filters_by_author(self) -> None:
        self.assertEqual(collect_commits(self.repo, 2026, "other@nope.com"), [])

    def test_filters_by_author_date_not_committer_date(self) -> None:
        (self.repo / "g.txt").write_text("second\n")
        self._git("add", "g.txt")
        self._git(
            "commit", "-q", "-m", "rebased commit",
            env={
                "GIT_AUTHOR_DATE": "2026-11-20T09:00:00",
                "GIT_COMMITTER_DATE": "2027-01-05T09:00:00",
            },
        )

        commits_2026 = collect_commits(self.repo, 2026, "me@example.com")
        subjects_2026 = [c.subject for c in commits_2026]
        self.assertIn("rebased commit", subjects_2026)

        commits_2027 = collect_commits(self.repo, 2027, "me@example.com")
        subjects_2027 = [c.subject for c in commits_2027]
        self.assertNotIn("rebased commit", subjects_2027)


if __name__ == "__main__":
    unittest.main()
