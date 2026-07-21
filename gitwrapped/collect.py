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
    """Renvoie les commits de `repo` sur `year` (date AUTEUR), filtrés par `author` (email).

    Le filtre `--since`/`--until` de git s'applique à la date de committer, pas
    à la date d'auteur (`%aI`, utilisée pour `Commit.when`). On élargit donc la
    fenêtre d'un an de chaque côté pour absorber le décalage auteur/committer
    (rebase, cherry-pick, amend), puis on filtre précisément après coup sur
    `c.when.year`.
    """
    cmd = [
        "git", "-C", str(repo), "log",
        f"--since={year - 1}-01-01T00:00:00",
        f"--until={year + 2}-01-01T00:00:00",
        "--numstat", f"--pretty={_FORMAT}",
    ]
    if author:
        cmd.append(f"--author={author}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    commits = parse_git_log(result.stdout, repo.name)
    return [c for c in commits if c.when.year == year]


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
