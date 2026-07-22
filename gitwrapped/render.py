"""Génération d'une page HTML autonome : story portrait, néo-brutalisme sombre.

Parti pris (construit carte par carte) : canevas quasi-noir commun, structure
brutaliste assumée (bordures franches, ombres dures décalées, hairlines, labels
mono exposés), et UNE couleur signal vive par carte. Zéro dépendance externe :
polices embarquées en base64, données injectées inline.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

_ASSETS = Path(__file__).parent / "assets"
_FONTS = [
    ("Grotesk", 500, "SpaceGrotesk-500.woff2"),
    ("Grotesk", 700, "SpaceGrotesk-700.woff2"),
    ("Mono", 700, "SpaceMono-700.woff2"),
]


def _font_faces() -> str:
    faces = []
    for family, weight, fname in _FONTS:
        data = base64.b64encode((_ASSETS / fname).read_bytes()).decode()
        faces.append(
            "@font-face{font-family:'" + family + "';font-style:normal;font-weight:"
            + str(weight) + ";font-display:swap;src:url(data:font/woff2;base64,"
            + data + ") format('woff2');}"
        )
    return "".join(faces)


_WRAPPED_CSS = (Path(__file__).parent.parent / "web" / "wrapped.css").read_text(encoding="utf-8")
_WRAPPED_JS = (Path(__file__).parent.parent / "web" / "wrapped.js").read_text(encoding="utf-8")

_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Git Wrapped __YEAR__</title>
<style>__FONTS__
__CSS__</style>
</head>
<body>
<div id="app"></div>
<script>__JS__
renderWrapped(document.getElementById("app"), __DATA__);
</script>
</body>
</html>
"""


def render(stats: dict, output_path: Path) -> None:
    """Écrit une page HTML autonome à `output_path` à partir de `stats`."""
    data = json.dumps(stats, ensure_ascii=False).replace("<", "\\u003c")
    html = (_TEMPLATE
            .replace("__FONTS__", _font_faces())
            .replace("__CSS__", _WRAPPED_CSS)
            .replace("__JS__", _WRAPPED_JS)
            .replace("__YEAR__", str(stats["year"]))
            .replace("__DATA__", data))
    output_path.write_text(html, encoding="utf-8")
