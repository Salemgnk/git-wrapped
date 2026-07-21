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
