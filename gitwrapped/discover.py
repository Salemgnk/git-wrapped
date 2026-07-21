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
