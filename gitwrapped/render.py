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
  if (S.words.emojis.length)
    list("Tes emojis", S.words.emojis.map(e => e.emoji + "  ·  " + e.count));
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
