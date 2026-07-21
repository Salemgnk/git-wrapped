import os
import tempfile
import unittest
from pathlib import Path

from gitwrapped.discover import find_repos


def make_repo(path: Path) -> None:
    (path / ".git").mkdir(parents=True)


class FindReposTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_finds_nested_repos(self) -> None:
        make_repo(self.root / "a")
        make_repo(self.root / "sub" / "b")
        (self.root / "not_a_repo").mkdir()
        found = find_repos([str(self.root)])
        names = sorted(p.name for p in found)
        self.assertEqual(names, ["a", "b"])

    def test_does_not_recurse_into_found_repo(self) -> None:
        make_repo(self.root / "outer")
        make_repo(self.root / "outer" / "inner")
        found = find_repos([str(self.root)])
        self.assertEqual([p.name for p in found], ["outer"])

    def test_skips_node_modules(self) -> None:
        make_repo(self.root / "node_modules" / "pkg")
        make_repo(self.root / "real")
        found = find_repos([str(self.root)])
        self.assertEqual([p.name for p in found], ["real"])

    def test_returns_absolute_paths(self) -> None:
        make_repo(self.root / "a")
        found = find_repos([str(self.root)])
        self.assertTrue(found[0].is_absolute())


if __name__ == "__main__":
    unittest.main()
