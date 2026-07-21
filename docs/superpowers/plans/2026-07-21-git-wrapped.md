# Git Wrapped Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une commande CLI qui scanne des dossiers racines, agrège les commits d'un auteur sur une année, et génère une page HTML autonome façon *Spotify Wrapped*.

**Architecture:** Package Python `gitwrapped/` avec quatre modules à responsabilité unique (`discover`, `collect`, `analyze`, `render`) orchestrés par un CLI `git_wrapped.py`. Le flux est linéaire : découvrir les repos → collecter les commits normalisés → analyser (fonction pure) → rendre le HTML. `analyze` ne fait aucune I/O pour être trivialement testable.

**Tech Stack:** Python 3.14, stdlib uniquement (`subprocess`, `argparse`, `dataclasses`, `datetime`, `collections`, `re`, `pathlib`). Tests avec `unittest` (stdlib). Aucune dépendance externe. Le HTML généré n'a aucune ressource externe (CSS/JS/données inline).

## Global Constraints

- **Python stdlib uniquement** — aucune dépendance pip, ni pour le code ni pour les tests (`unittest`, pas `pytest`).
- **Sortie HTML autoportante** — tout CSS/JS/données inline, zéro `<link>`/`<script src>`/font externe.
- **Périmètre figé** : multi-repos, filtré sur un auteur (email git), une année. Pas de multi-auteurs, pas de comparaison inter-années, pas d'API distante, pas de serveur.
- **Séparateurs git log** : record = `\x1e` (RS), champ = `\x1f` (US). Format exact : `--pretty=format:%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s` avec `--numstat`.
- **Fuseau** : les datetimes de commit sont converties en heure locale (`.astimezone()`) avant analyse.
- **Structure du projet** :
  ```
  git-wrapped/
    git_wrapped.py          # orchestrateur CLI
    gitwrapped/
      __init__.py
      discover.py
      collect.py
      analyze.py
      render.py
    tests/
      __init__.py
      test_discover.py
      test_collect.py
      test_analyze.py
  ```
- Commande de test globale : `python -m unittest discover -s tests -v` (lancée depuis `git-wrapped/`).

---

### Task 1: `discover.py` — découverte des dépôts git

**Files:**
- Create: `gitwrapped/__init__.py` (vide)
- Create: `tests/__init__.py` (vide)
- Create: `gitwrapped/discover.py`
- Test: `tests/test_discover.py`

**Interfaces:**
- Consumes: rien.
- Produces: `find_repos(roots: list[str]) -> list[Path]` — renvoie les chemins (absolus, triés) des dossiers contenant un sous-dossier `.git`, cherchés récursivement sous chaque racine. N'entre pas dans un dépôt déjà trouvé, ni dans `node_modules`, `.venv`, `.git`.

- [ ] **Step 1: Write the failing test**

Create `tests/__init__.py` (empty) and `gitwrapped/__init__.py` (empty), then `tests/test_discover.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_discover -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gitwrapped.discover'`

- [ ] **Step 3: Write minimal implementation**

Create `gitwrapped/discover.py`:

```python
"""Découverte récursive des dépôts git sous des dossiers racines."""

from __future__ import annotations

import os
from pathlib import Path

_SKIP_DIRS = {"node_modules", ".venv", "venv", ".git", "__pycache__"}


def find_repos(roots: list[str]) -> list[Path]:
    """Renvoie les dépôts git (dossiers contenant `.git`) sous `roots`.

    Recherche récursive. N'entre pas dans un dépôt déjà trouvé ni dans les
    dossiers de `_SKIP_DIRS`. Chemins absolus, triés, dédupliqués.
    """
    found: set[Path] = set()
    for root in roots:
        base = Path(root).expanduser().resolve()
        if not base.is_dir():
            continue
        for dirpath, dirnames, _filenames in os.walk(base):
            current = Path(dirpath)
            if (current / ".git").exists():
                found.add(current)
                dirnames[:] = []  # ne pas descendre dans un dépôt
                continue
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
    return sorted(found)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_discover -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add gitwrapped/__init__.py tests/__init__.py gitwrapped/discover.py tests/test_discover.py
git commit -m "feat: discover git repositories under root directories"
```

---

### Task 2: `collect.py` — extraction des commits normalisés

**Files:**
- Create: `gitwrapped/collect.py`
- Test: `tests/test_collect.py`

**Interfaces:**
- Consumes: rien des autres tâches.
- Produces:
  - `@dataclass Commit` avec champs : `hash: str`, `author_name: str`, `author_email: str`, `when: datetime` (aware, locale), `subject: str`, `repo: str`, `added: int`, `deleted: int`, `files: list[str]`.
  - `parse_git_log(output: str, repo_name: str) -> list[Commit]` — parse pur (sans I/O) de la sortie `git log` formatée.
  - `collect_commits(repo: Path, year: int, author: str | None) -> list[Commit]` — lance git et renvoie les commits de l'année pour l'auteur.
  - `default_author() -> str | None` — lit `git config user.email`, `None` si absent.

- [ ] **Step 1: Write the failing test**

Create `tests/test_collect.py`:

```python
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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_collect -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gitwrapped.collect'`

- [ ] **Step 3: Write minimal implementation**

Create `gitwrapped/collect.py`:

```python
"""Extraction des commits normalisés d'un dépôt git via `git log`."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

RS = "\x1e"  # record separator
US = "\x1f"  # unit (field) separator
_FORMAT = f"format:{RS}%H{US}%an{US}%ae{US}%aI{US}%s"


@dataclass
class Commit:
    hash: str
    author_name: str
    author_email: str
    when: datetime  # aware, heure locale
    subject: str
    repo: str
    added: int
    deleted: int
    files: list[str] = field(default_factory=list)


def parse_git_log(output: str, repo_name: str) -> list[Commit]:
    """Parse la sortie de `git log --numstat --pretty=<_FORMAT>` (sans I/O)."""
    commits: list[Commit] = []
    for record in output.split(RS):
        record = record.strip("\n")
        if not record.strip():
            continue
        lines = record.split("\n")
        parts = lines[0].split(US)
        if len(parts) < 5:
            continue
        hsh, an, ae, iso, subject = parts[0], parts[1], parts[2], parts[3], US.join(parts[4:])
        added = deleted = 0
        files: list[str] = []
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            cols = line.split("\t")
            if len(cols) != 3:
                continue
            a, d, path = cols
            added += 0 if a == "-" else int(a)
            deleted += 0 if d == "-" else int(d)
            files.append(path)
        when = datetime.fromisoformat(iso).astimezone()
        commits.append(Commit(hsh, an, ae, when, subject, repo_name, added, deleted, files))
    return commits


def collect_commits(repo: Path, year: int, author: str | None) -> list[Commit]:
    """Renvoie les commits de `repo` sur `year`, filtrés par `author` (email)."""
    cmd = [
        "git", "-C", str(repo), "log",
        f"--since={year}-01-01T00:00:00",
        f"--until={year + 1}-01-01T00:00:00",
        "--numstat", f"--pretty={_FORMAT}",
    ]
    if author:
        cmd.append(f"--author={author}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    return parse_git_log(result.stdout, repo.name)


def default_author() -> str | None:
    """Renvoie `git config user.email`, ou None si indisponible."""
    try:
        result = subprocess.run(
            ["git", "config", "user.email"],
            capture_output=True, text=True, check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    email = result.stdout.strip()
    return email or None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_collect -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add gitwrapped/collect.py tests/test_collect.py
git commit -m "feat: collect and parse normalized commits from git log"
```

---

### Task 3: `analyze.py` — calcul des statistiques (fonction pure)

**Files:**
- Create: `gitwrapped/analyze.py`
- Test: `tests/test_analyze.py`

**Interfaces:**
- Consumes: `Commit` de `gitwrapped.collect`.
- Produces: `analyze(commits: list[Commit], year: int) -> dict` — dict sérialisable avec les clés de premier niveau : `year`, `total_commits`, `empty` (bool), et quatre sous-dicts `volume`, `rhythm`, `projects`, `words`. Structure exacte détaillée dans l'implémentation ci-dessous ; les tests fixent le contrat.

- [ ] **Step 1: Write the failing test**

Create `tests/test_analyze.py`:

```python
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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_analyze -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gitwrapped.analyze'`

- [ ] **Step 3: Write minimal implementation**

Create `gitwrapped/analyze.py`:

```python
"""Calcul des statistiques du Wrapped à partir d'une liste de commits (pur)."""

from __future__ import annotations

import re
from collections import Counter
from datetime import date, timedelta

from gitwrapped.collect import Commit

_STOP_WORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
    "le", "la", "les", "un", "une", "de", "des", "du", "et", "à", "en",
    "pour", "dans", "sur", "au", "aux", "ce", "cette", "is", "it", "this",
}
_WORD_RE = re.compile(r"[a-zA-Zà-ÿ]{2,}")
_EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF]"
)


def analyze(commits: list[Commit], year: int) -> dict:
    """Renvoie un dict de stats sérialisable à partir des commits de l'année."""
    if not commits:
        return {"year": year, "total_commits": 0, "empty": True,
                "volume": {}, "rhythm": {}, "projects": {}, "words": {}}
    return {
        "year": year,
        "total_commits": len(commits),
        "empty": False,
        "volume": _volume(commits),
        "rhythm": _rhythm(commits),
        "projects": _projects(commits),
        "words": _words(commits),
    }


def _volume(commits: list[Commit]) -> dict:
    added = sum(c.added for c in commits)
    deleted = sum(c.deleted for c in commits)
    per_day: Counter[date] = Counter(c.when.date() for c in commits)
    busiest_date, busiest_count = per_day.most_common(1)[0]
    return {
        "added": added,
        "deleted": deleted,
        "longest_streak": _longest_streak(set(per_day)),
        "busiest_day": {"date": busiest_date.isoformat(), "count": busiest_count},
        "active_days": len(per_day),
    }


def _longest_streak(days: set[date]) -> int:
    if not days:
        return 0
    best = cur = 1
    ordered = sorted(days)
    for prev, nxt in zip(ordered, ordered[1:]):
        if nxt - prev == timedelta(days=1):
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
    return best


def _rhythm(commits: list[Commit]) -> dict:
    heatmap = [[0] * 24 for _ in range(7)]  # [jour de semaine 0=lundi][heure]
    hour_counts: Counter[int] = Counter()
    weekday_counts: Counter[int] = Counter()
    night = 0
    for c in commits:
        wd = c.when.weekday()
        hr = c.when.hour
        heatmap[wd][hr] += 1
        hour_counts[hr] += 1
        weekday_counts[wd] += 1
        if hr >= 22 or hr <= 5:
            night += 1
    peak_hour = hour_counts.most_common(1)[0][0]
    peak_weekday = weekday_counts.most_common(1)[0][0]
    return {
        "heatmap": heatmap,
        "peak_hour": peak_hour,
        "peak_weekday": peak_weekday,
        "night_owl_pct": round(100 * night / len(commits)),
    }


def _projects(commits: list[Commit]) -> dict:
    repo_counts: Counter[str] = Counter(c.repo for c in commits)
    file_counts: Counter[str] = Counter()
    lang_counts: Counter[str] = Counter()
    for c in commits:
        for path in c.files:
            file_counts[path] += 1
            dot = path.rfind(".")
            slash = path.rfind("/")
            if dot > slash and dot != -1:
                lang_counts[path[dot:].lower()] += 1
    top_file = None
    if file_counts:
        path, count = file_counts.most_common(1)[0]
        top_file = {"path": path, "count": count}
    return {
        "top_repos": [{"name": n, "count": c} for n, c in repo_counts.most_common(5)],
        "top_file": top_file,
        "languages": [{"ext": e, "count": c} for e, c in lang_counts.most_common(6)],
    }


def _words(commits: list[Commit]) -> dict:
    word_counts: Counter[str] = Counter()
    emoji_counts: Counter[str] = Counter()
    fix = 0
    longest = ""
    for c in commits:
        subject = c.subject
        if "fix" in subject.lower():
            fix += 1
        if len(subject) > len(longest):
            longest = subject
        for w in _WORD_RE.findall(subject.lower()):
            if w not in _STOP_WORDS:
                word_counts[w] += 1
        for e in _EMOJI_RE.findall(subject):
            emoji_counts[e] += 1
    return {
        "top_words": [{"word": w, "count": c} for w, c in word_counts.most_common(10)],
        "fix_rate_pct": round(100 * fix / len(commits)),
        "longest_subject": longest,
        "emojis": [{"emoji": e, "count": c} for e, c in emoji_counts.most_common(5)],
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_analyze -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add gitwrapped/analyze.py tests/test_analyze.py
git commit -m "feat: compute wrapped statistics from commits"
```

---

### Task 4: `render.py` — génération de la page HTML autonome

**Files:**
- Create: `gitwrapped/render.py`
- Test: `tests/test_render.py`

**Interfaces:**
- Consumes: le `dict` produit par `analyze`.
- Produces: `render(stats: dict, output_path: Path) -> None` — écrit une page HTML autoportante (CSS/JS/données inline) à `output_path`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_render.py`:

```python
import json
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
        if empty:
            return {"year": 2026, "total_commits": 0, "empty": True,
                    "volume": {}, "rhythm": {}, "projects": {}, "words": {}}
        return {
            "year": 2026, "total_commits": 42, "empty": False,
            "volume": {"added": 100, "deleted": 20, "longest_streak": 5,
                       "busiest_day": {"date": "2026-04-10", "count": 7},
                       "active_days": 30},
            "rhythm": {"heatmap": [[0] * 24 for _ in range(7)], "peak_hour": 2,
                       "peak_weekday": 0, "night_owl_pct": 60},
            "projects": {"top_repos": [{"name": "alpha", "count": 10}],
                         "top_file": {"path": "a.py", "count": 8},
                         "languages": [{"ext": ".py", "count": 20}]},
            "words": {"top_words": [{"word": "bug", "count": 5}],
                      "fix_rate_pct": 40, "longest_subject": "refactor everything",
                      "emojis": []},
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

    def test_escapes_html_in_strings(self) -> None:
        stats = self._stats()
        stats["words"]["longest_subject"] = "<script>alert(1)</script>"
        render(stats, self.out)
        html = self.out.read_text(encoding="utf-8")
        self.assertNotIn("<script>alert(1)</script>", html)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_render -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gitwrapped.render'`

- [ ] **Step 3: Write minimal implementation**

Create `gitwrapped/render.py`. Les données sont injectées en JSON (via `json.dumps`, qui échappe `<` en `<` avec `ensure_ascii` désactivé mais on force l'échappement des chevrons) et le rendu des cartes est fait en JS vanilla depuis ce JSON, ce qui garantit l'échappement HTML par `textContent`.

```python
"""Génération d'une page HTML autonome façon Spotify Wrapped."""

from __future__ import annotations

import json
from pathlib import Path

_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Git Wrapped __YEAR__</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; background: #0b0b14; color: #f2f2f7;
  font-family: system-ui, -apple-system, sans-serif; }
#app { height: 100%; overflow-y: scroll; scroll-snap-type: y mandatory; }
.card { height: 100vh; scroll-snap-align: start; display: flex;
  flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 2rem; gap: 1rem; }
.card h2 { font-size: clamp(1rem, 3vw, 1.6rem); text-transform: uppercase;
  letter-spacing: .2em; opacity: .7; font-weight: 600; }
.big { font-size: clamp(3rem, 14vw, 9rem); font-weight: 800; line-height: 1;
  background: linear-gradient(135deg, #a78bfa, #f472b6, #fbbf24);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.sub { font-size: clamp(1rem, 4vw, 1.6rem); opacity: .85; }
.list { display: flex; flex-direction: column; gap: .4rem; font-size: 1.2rem; }
.heatmap { display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px;
  max-width: 720px; width: 100%; }
.heatmap i { aspect-ratio: 1; border-radius: 2px; background: rgba(167,139,250,.12); }
.hint { position: fixed; bottom: 1rem; left: 0; right: 0; text-align: center;
  opacity: .4; font-size: .85rem; }
.card:nth-child(odd) { background: radial-gradient(circle at 50% 30%, #17172b, #0b0b14); }
</style>
</head>
<body>
<div id="app"></div>
<div class="hint">defile pour continuer</div>
<script id="data" type="application/json">__DATA__</script>
<script>
const S = JSON.parse(document.getElementById("data").textContent);
const app = document.getElementById("app");
const el = (tag, cls, text) => { const e = document.createElement(tag);
  if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function card(children) { const c = el("div", "card");
  children.filter(Boolean).forEach(ch => c.appendChild(ch)); app.appendChild(c); }
function metric(title, big, sub) {
  card([el("h2", null, title), el("div", "big", big), sub && el("div", "sub", sub)]);
}
function list(title, items) {
  const box = el("div", "list");
  items.forEach(t => box.appendChild(el("div", null, t)));
  card([el("h2", null, title), box]);
}

card([el("h2", null, "Ton annee en code"), el("div", "big", String(S.year))]);

if (S.empty) {
  metric("Aucun commit", "0", "Rien a wrapper cette annee. Reviens l'an prochain.");
} else {
  metric("Commits", String(S.total_commits),
    "+" + S.volume.added + " / -" + S.volume.deleted + " lignes");
  metric("Plus longue serie", S.volume.longest_streak + " jours",
    S.volume.active_days + " jours actifs au total");
  metric("Journee record", String(S.volume.busiest_day.count) + " commits",
    "le " + S.volume.busiest_day.date);

  const days = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  metric(S.rhythm.night_owl_pct >= 50 ? "Night owl" : "Early bird",
    S.rhythm.night_owl_pct + "%", "de commits la nuit (22h-5h)");
  metric("Heure de pointe", S.rhythm.peak_hour + "h",
    "jour prefere : " + days[S.rhythm.peak_weekday]);

  // Heatmap
  const flat = S.rhythm.heatmap.flat();
  const max = Math.max(1, ...flat);
  const grid = el("div", "heatmap");
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    const cell = el("i");
    const v = S.rhythm.heatmap[d][h] / max;
    if (v > 0) cell.style.background =
      "rgba(244,114,182," + (0.15 + 0.85 * v).toFixed(2) + ")";
    grid.appendChild(cell);
  }
  card([el("h2", null, "Ton rythme (jour x heure)"), grid]);

  if (S.projects.top_repos.length)
    list("Top projets", S.projects.top_repos.map(
      r => r.name + "  ·  " + r.count + " commits"));
  if (S.projects.top_file)
    metric("Fichier le plus retouche", String(S.projects.top_file.count) + "x",
      S.projects.top_file.path);
  if (S.projects.languages.length)
    list("Langages", S.projects.languages.map(l => l.ext + "  ·  " + l.count));

  if (S.words.top_words.length)
    list("Tes mots", S.words.top_words.map(w => w.word + "  ·  " + w.count));
  metric("Taux de \\"fix\\"", S.words.fix_rate_pct + "%",
    "message le plus long : " + S.words.longest_subject);
}

card([el("h2", null, "C'est un wrap"), el("div", "big", String(S.year)),
  el("div", "sub", "Git Wrapped")]);
</script>
</body>
</html>
"""


def render(stats: dict, output_path: Path) -> None:
    """Écrit une page HTML autonome à `output_path` à partir de `stats`."""
    data = json.dumps(stats, ensure_ascii=False).replace("<", "\\u003c")
    html = _TEMPLATE.replace("__YEAR__", str(stats["year"])).replace("__DATA__", data)
    output_path.write_text(html, encoding="utf-8")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_render -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add gitwrapped/render.py tests/test_render.py
git commit -m "feat: render self-contained wrapped HTML page"
```

---

### Task 5: `git_wrapped.py` — orchestrateur CLI

**Files:**
- Create: `git_wrapped.py`
- Create: `README.md`

**Interfaces:**
- Consumes: `find_repos`, `collect_commits`, `default_author`, `analyze`, `render`.
- Produces: `main(argv: list[str] | None = None) -> int` — point d'entrée CLI. Retourne 0 en succès.

- [ ] **Step 1: Write the implementation**

Create `git_wrapped.py`:

```python
#!/usr/bin/env python3
"""Git Wrapped — genere une retrospective HTML de ton annee en code."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from gitwrapped.analyze import analyze
from gitwrapped.collect import collect_commits, default_author
from gitwrapped.discover import find_repos
from gitwrapped.render import render


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Genere une page HTML 'Wrapped' de ton annee en code.")
    parser.add_argument("roots", nargs="+",
                        help="dossiers racines a scanner recursivement")
    parser.add_argument("--year", type=int, default=datetime.now().year,
                        help="annee couverte (defaut: annee courante)")
    parser.add_argument("--author", default=None,
                        help="email git a filtrer (defaut: git config user.email)")
    parser.add_argument("-o", "--output", default=None,
                        help="fichier HTML de sortie (defaut: git-wrapped-<year>.html)")
    args = parser.parse_args(argv)

    author = args.author or default_author()
    if author is None:
        print("Avertissement: aucun auteur (git config user.email vide). "
              "Tous les auteurs seront comptes.", file=sys.stderr)

    repos = find_repos(args.roots)
    if not repos:
        print("Aucun depot git trouve sous les racines fournies.", file=sys.stderr)

    commits = []
    for repo in repos:
        commits.extend(collect_commits(repo, args.year, author))

    stats = analyze(commits, args.year)
    output = Path(args.output) if args.output else Path(f"git-wrapped-{args.year}.html")
    render(stats, output)

    print(f"OK: {stats['total_commits']} commits, {len(repos)} depots "
          f"-> {output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Smoke test on this very repo**

Run:
```bash
python git_wrapped.py . --year 2026 -o /tmp/git-wrapped-smoke.html && \
  grep -q "Ton annee en code" /tmp/git-wrapped-smoke.html && echo SMOKE_OK
```
Expected: affiche une ligne `OK: ... commits, 1 depots -> ...` puis `SMOKE_OK`.

- [ ] **Step 3: Write the README**

Create `README.md`:

````markdown
# Git Wrapped

Une rétrospective HTML façon *Spotify Wrapped* de ton année en code, générée
localement à partir de tes dépôts git. Aucune dépendance : Python 3 + git.

## Utilisation

```bash
python git_wrapped.py ~/Documents/Perso ~/code \
    --year 2026 \
    --author ton.email@example.com \
    -o wrapped.html
```

- `roots` : un ou plusieurs dossiers scannés récursivement (tout dépôt git
  dessous est inclus).
- `--year` : année couverte (défaut : année courante).
- `--author` : email git filtré (défaut : `git config user.email`).
- `-o` : fichier de sortie (défaut : `git-wrapped-<year>.html`).

Ouvre ensuite le `.html` dans un navigateur et fais défiler.

## Tests

```bash
python -m unittest discover -s tests -v
```
````

- [ ] **Step 4: Run the full test suite**

Run: `python -m unittest discover -s tests -v`
Expected: PASS (tous les tests, ~23)

- [ ] **Step 5: Commit**

```bash
git add git_wrapped.py README.md
git commit -m "feat: CLI orchestrator and README"
```

---

## Self-Review

**Spec coverage :**
- Périmètre multi-repos → Task 1 (`find_repos`). ✓
- Filtre auteur + année → Task 2 (`collect_commits`, `default_author`). ✓
- Volume & streaks, Rythme & horaires, Projets, Mots & humeur → Task 3 (`_volume`, `_rhythm`, `_projects`, `_words`). ✓
- Sortie HTML autonome, cartes défilantes, thème sombre, heatmap → Task 4 (`render`). ✓
- CLI avec options `--year/--author/-o` + défauts → Task 5. ✓
- Cas limites (aucun repo, année vide, git absent, binaires `-`) → Task 2 (try/except, `-`→0), Task 3 (`empty`), Task 4 (empty render), Task 5 (avertissements). ✓
- Tests d'`analyze` (pur) et de `collect` (repo temporaire) → Tasks 2 & 3. ✓

**Placeholder scan :** aucun TBD/TODO ; tout le code est complet et exécutable.

**Type consistency :** `Commit(hash, author_name, author_email, when, subject, repo, added, deleted, files)` identique entre Task 2 (définition), Task 3 (consommation) et les tests. `analyze(commits, year) -> dict` avec clés `volume/rhythm/projects/words` cohérentes entre Tasks 3 et 4. `render(stats, output_path)` cohérent entre Tasks 4 et 5. Noms de fonctions (`find_repos`, `collect_commits`, `default_author`, `analyze`, `render`) identiques partout.
