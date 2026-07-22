# Git Wrapped Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une app web où l'on tape un pseudo GitHub et qui affiche la story « wrapped » existante, alimentée par l'API GitHub via un backend serverless, en réutilisant le CLI local et son contrat de stats.

**Architecture:** Un `dict` de stats partagé est l'interface unique. La story (CSS+JS) est extraite en assets réutilisables : le CLI Python les inline (sortie autonome), l'app web les charge et fetch les stats depuis une fonction `api/wrapped` (Node) qui interroge GitHub GraphQL avec un token serveur et produit le même contrat.

**Tech Stack:** Python 3 (CLI existant), Node ≥ 20 (fonction serverless, `fetch` + `node:test` **natifs**, zéro dépendance npm), HTML/CSS/JS statique, Vercel (statique `web/` + fonction `api/`).

## Global Constraints

- **Backend Node : zéro dépendance npm.** Utiliser `fetch` global et `node:test` (intégrés à Node ≥ 20). Lancer les tests avec `node --test`.
- **`GITHUB_TOKEN` serveur uniquement** : lu via `process.env.GITHUB_TOKEN`, jamais renvoyé au client ni inséré dans le HTML.
- **Regex pseudo GitHub** : `^[a-zA-Z0-9-]{1,39}$`. Rejeter (400) avant tout appel réseau.
- **Contrat de stats** (identique à la sortie de `gitwrapped/analyze.analyze`) — clés de premier niveau : `year, total_commits, empty, volume, rhythm, projects, words, contributions, archetype`. Sous-formes exactes dans le spec `docs/superpowers/specs/2026-07-22-git-wrapped-web-design.md`.
- **`projects.top_file` vaut `null`** dans le chemin web (non dispo à faible coût).
- **Story JS = une fonction unique** `renderWrapped(mount, S)` (dans `web/wrapped.js`) : construit tout le DOM (stage/chrome/deck + slides + nav/musique/quizz/partage) dans `mount` à partir du contrat `S`.
- **Sortie CLI autonome** : `render.py` inline les polices en base64 + `web/wrapped.css` + `web/wrapped.js` ; aucune ressource externe (pas de `<link>`, pas de `src="http"`/`href="http"`).
- **Web** : les polices sont servies en fichiers (`web/fonts/*.woff2`) via `web/fonts.css` (url relatives) — pas de base64 côté web.
- **Année** : défaut = année courante ; le frontend/copie gère déjà « jusqu'ici » via `S.year === new Date().getFullYear()`.

### Structure des fichiers

```
web/
  index.html         # accueil (champ pseudo) + montage de la story
  wrapped.css        # styles de la story (SANS @font-face)
  wrapped.js         # renderWrapped(mount, S) — moteur complet de la story
  fonts.css          # @font-face url(./fonts/*.woff2)  (web only)
  fonts/             # copie des woff2 (Space Grotesk/Mono)
api/
  github-to-stats.js         # githubToStats(input) -> contrat  (pur, testable)
  github-to-stats.test.js    # node:test + fixtures
  github-client.js           # graphql(query, vars, token) -> data ; fetchWrapped(user, year, token)
  wrapped.js                 # handler HTTP : valide, orchestre, code erreurs
  wrapped.test.js            # node:test (fetch mocké)
  fixtures/                  # réponses GraphQL enregistrées (JSON)
gitwrapped/                  # CLI Python inchangé (render.py refactoré)
package.json                 # scripts de test Node (pas de deps)
vercel.json                  # routage statique + fonction
```

---

### Task 1 : Extraire la story en assets partagés + refactor `render.py`

**Files:**
- Create: `web/wrapped.css`, `web/wrapped.js`, `web/fonts.css`, `web/fonts/` (copie des woff2)
- Modify: `gitwrapped/render.py`
- Test: `tests/test_render.py` (existant — doit rester vert)

**Interfaces:**
- Consumes: le contrat `S` produit par `analyze`.
- Produces: `web/wrapped.js` exposant globalement `function renderWrapped(mount, S)` ; `render.py` produit un HTML autonome qui appelle `renderWrapped(document.getElementById('app'), <stats>)`.

Il s'agit d'un **refactor mécanique** (déplacer du code existant, pas le réécrire) :

- [ ] **Step 1 : Copier les polices web**

```bash
mkdir -p web/fonts
cp gitwrapped/assets/SpaceGrotesk-500.woff2 gitwrapped/assets/SpaceGrotesk-700.woff2 \
   gitwrapped/assets/SpaceMono-700.woff2 web/fonts/
```

- [ ] **Step 2 : `web/fonts.css`** (version web, url relatives — le CLI garde le base64)

```css
@font-face{font-family:'Grotesk';font-style:normal;font-weight:500;font-display:swap;src:url(./fonts/SpaceGrotesk-500.woff2) format('woff2');}
@font-face{font-family:'Grotesk';font-style:normal;font-weight:700;font-display:swap;src:url(./fonts/SpaceGrotesk-700.woff2) format('woff2');}
@font-face{font-family:'Mono';font-style:normal;font-weight:700;font-display:swap;src:url(./fonts/SpaceMono-700.woff2) format('woff2');}
```

- [ ] **Step 3 : `web/wrapped.css`** — coller **tel quel** tout le contenu actuel du bloc `<style>` de `_TEMPLATE` dans `render.py`, **en retirant** la ligne `__FONTS__` (les @font-face sont fournis séparément).

- [ ] **Step 4 : `web/wrapped.js`** — envelopper le JS actuel dans une fonction. Prendre **tout** le contenu du bloc `<script>` de `_TEMPLATE` et le placer dans :

```js
function renderWrapped(mount, S) {
  // 1) construire le squelette (aujourd'hui statique dans le HTML) :
  mount.innerHTML =
    '<div class="stage" id="stage">'
    + '<div class="chrome"><div class="sysbar"><span><span class="dot">●</span> git-wrapped</span>'
    + '<span id="counter">01 / 01</span></div><div class="prog" id="prog"></div></div>'
    + '<div class="deck" id="deck"></div></div>';
  const deck = mount.querySelector("#deck");
  // 2) coller ici TOUT l'ancien contenu du <script>, en supprimant sa
  //    première ligne `const S = JSON.parse(...)` et sa ligne
  //    `const deck = document.getElementById("deck")` (déjà définis ci-dessus).
  //    Remplacer chaque `document.getElementById("stage"|"prog"|"counter")`
  //    par `mount.querySelector("#stage"|"#prog"|"#counter")`.
}
window.renderWrapped = renderWrapped;
```

Vérifier qu'aucune autre référence à `document.getElementById(` d'un nœud du squelette ne subsiste (les slides sont créés en JS, donc OK).

- [ ] **Step 5 : Refactor `render.py`** — remplacer `_TEMPLATE` et `render()` par un gabarit court qui inline les assets. Remplacer le corps du module `render.py` (après les imports + `_font_faces`) par :

```python
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
    data = json.dumps(stats, ensure_ascii=False).replace("<", "\\u003c")
    html = (_TEMPLATE
            .replace("__FONTS__", _font_faces())
            .replace("__CSS__", _WRAPPED_CSS)
            .replace("__JS__", _WRAPPED_JS)
            .replace("__YEAR__", str(stats["year"]))
            .replace("__DATA__", data))
    output_path.write_text(html, encoding="utf-8")
```

(Garder `import base64, json`, `from pathlib import Path`, `_ASSETS`, `_FONTS`, `_font_faces` inchangés.)

- [ ] **Step 6 : Lancer les tests Python + smoke**

Run:
```bash
python -m unittest discover -s tests -v
python git_wrapped.py . --year 2026 -o /tmp/gw-smoke.html && grep -q "renderWrapped" /tmp/gw-smoke.html && echo SMOKE_OK
```
Expected : suite verte (37 tests), `SMOKE_OK`. Si `test_render` échoue, corriger l'extraction (contenu manquant/altéré), pas le test.

- [ ] **Step 7 : Commit**

```bash
git add web/ gitwrapped/render.py
git commit -m "refactor: extract story into shared web assets, inline them in the CLI"
```

---

### Task 2 : Page d'accueil web + fetch (contre un contrat mocké)

**Files:**
- Create: `web/index.html`
- Test: manuel (smoke navigateur) — pas de test auto ici

**Interfaces:**
- Consumes: `renderWrapped(mount, S)` de `web/wrapped.js`, l'endpoint `GET /api/wrapped?user&year` (pas encore implémenté ; on mocke).
- Produces: la page publique de l'app.

- [ ] **Step 1 : `web/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Git Wrapped</title>
<link rel="stylesheet" href="./fonts.css">
<link rel="stylesheet" href="./wrapped.css">
<style>
  body { margin:0; background:#050506; color:#F4F3EE; font-family:'Grotesk',system-ui,sans-serif;
    min-height:100dvh; display:flex; align-items:center; justify-content:center; }
  .landing { text-align:center; padding:24px; }
  .landing h1 { font-family:'Mono',monospace; font-size:clamp(28px,6vw,52px); font-weight:700;
    letter-spacing:-.03em; }
  .landing .sub { color:#8b8b85; margin:8px 0 28px; font-family:'Mono',monospace; }
  .landing form { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .landing input { background:#141417; border:2px solid #2A2A31; color:#F4F3EE; font-size:18px;
    padding:14px 16px; font-family:'Mono',monospace; min-width:min(280px,72vw); }
  .landing button { background:#D6FF3D; color:#0C0C0E; border:none; font-weight:800; font-size:18px;
    padding:14px 22px; cursor:pointer; }
  .landing .err { color:#F0616D; margin-top:14px; min-height:1.4em; font-family:'Mono',monospace; }
  #app:empty { display:none; }
</style>
</head>
<body>
<div class="landing" id="landing">
  <h1>git wrapped</h1>
  <div class="sub">// ton année en code, en un pseudo GitHub</div>
  <form id="f"><input id="u" placeholder="pseudo GitHub" autocomplete="off"
    pattern="[A-Za-z0-9-]{1,39}" required>
    <button type="submit">voir mon wrapped</button></form>
  <div class="err" id="err"></div>
</div>
<div id="app"></div>
<script src="./wrapped.js"></script>
<script>
const f = document.getElementById("f"), errEl = document.getElementById("err"),
  landing = document.getElementById("landing"), app = document.getElementById("app");
f.addEventListener("submit", async e => {
  e.preventDefault();
  const user = document.getElementById("u").value.trim();
  errEl.textContent = "chargement…";
  try {
    const r = await fetch("/api/wrapped?user=" + encodeURIComponent(user));
    if (r.status === 404) { errEl.textContent = "pseudo introuvable."; return; }
    if (!r.ok) { errEl.textContent = "réessaie plus tard."; return; }
    const stats = await r.json();
    landing.style.display = "none";
    renderWrapped(app, stats);
  } catch (_) { errEl.textContent = "réessaie plus tard."; }
});
</script>
</body>
</html>
```

- [ ] **Step 2 : Smoke local avec un contrat mocké**

Run (sert le dossier et vérifie que la story se monte avec un faux contrat) :
```bash
cp /tmp/gw-smoke.html web/_mock.html  # rappel : un vrai contrat existe déjà dans une sortie CLI
python3 -m http.server 8899 --directory web >/dev/null 2>&1 &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8899/index.html
```
Expected : `200`. (Le fetch `/api/wrapped` échouera tant que le backend n'existe pas → message d'erreur attendu ; le montage de la story est validé séparément par Task 1.)

- [ ] **Step 3 : Commit**

```bash
git add web/index.html
git commit -m "feat: web landing page with username form and story mount"
```

---

### Task 3 : Transformateur `githubToStats` (pur, TDD)

**Files:**
- Create: `package.json`, `api/github-to-stats.js`, `api/github-to-stats.test.js`
- Create: `api/fixtures/sample-input.json`

**Interfaces:**
- Consumes: rien (fonction pure).
- Produces: `githubToStats(input) -> stats` (le contrat). `input` :
  ```
  { user, year,
    calendar: [ {date:'YYYY-MM-DD', count:int}, ... ],   // tous les jours de l'année (issus du contributionCalendar)
    reposByCommits: [ {name, count}, ... ],               // top repos (commitContributionsByRepository)
    commits: [ {repo, committedDate:ISO, message, additions, deletions}, ... ], // historique agrégé des top repos
    languages: [ {ext:'.js', count:int}, ... ] }          // tailles par extension (déjà en format ext)
  ```

- [ ] **Step 1 : `package.json`** (scripts, pas de dépendances)

```json
{
  "name": "git-wrapped-web",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test api/" }
}
```

- [ ] **Step 2 : Écrire les tests d'abord** — `api/github-to-stats.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { githubToStats } from "./github-to-stats.js";

function cal(year, entries) {
  // entries: {"YYYY-MM-DD": count}. On remplit une année de zéros puis on applique.
  const days = [];
  const d = new Date(Date.UTC(year, 0, 1)), end = new Date(Date.UTC(year, 11, 31));
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, count: entries[iso] || 0 });
  }
  return days;
}

test("empty when no commits", () => {
  const s = githubToStats({ user: "x", year: 2026, calendar: cal(2026, {}),
    reposByCommits: [], commits: [], languages: [] });
  assert.equal(s.empty, true);
  assert.equal(s.total_commits, 0);
  assert.equal(s.year, 2026);
  assert.equal(s.projects.top_file, null);
});

test("volume, streak, busiest day from calendar", () => {
  const s = githubToStats({ user: "x", year: 2026,
    calendar: cal(2026, { "2026-03-02": 3, "2026-03-03": 1, "2026-03-04": 2, "2026-03-06": 5 }),
    reposByCommits: [{ name: "a", count: 11 }],
    commits: [{ repo: "a", committedDate: "2026-03-02T02:00:00Z", message: "feat x",
      additions: 10, deletions: 3 }],
    languages: [{ ext: ".js", count: 100 }] });
  assert.equal(s.total_commits, 11);            // depuis le calendrier
  assert.equal(s.volume.longest_streak, 3);      // 2,3,4 mars consécutifs
  assert.deepEqual(s.volume.busiest_day, { date: "2026-03-06", count: 5 });
  assert.equal(s.volume.active_days, 4);
});

test("rhythm/words/lines from commit histories", () => {
  const s = githubToStats({ user: "x", year: 2026, calendar: cal(2026, { "2026-01-01": 2 }),
    reposByCommits: [{ name: "a", count: 2 }],
    commits: [
      { repo: "a", committedDate: "2026-01-01T03:00:00Z", message: "fix login bug",
        additions: 5, deletions: 1 },
      { repo: "a", committedDate: "2026-01-01T14:00:00Z", message: "fix logout bug",
        additions: 4, deletions: 2 }],
    languages: [{ ext: ".ts", count: 50 }, { ext: ".tsx", count: 30 }] });
  assert.equal(s.volume.added, 9);
  assert.equal(s.volume.deleted, 3);
  assert.equal(s.rhythm.night_owl_pct, 50);      // 1 commit à 3h sur 2
  assert.equal(s.words.fix_rate_pct, 100);
  const words = Object.fromEntries(s.words.top_words.map(w => [w.word, w.count]));
  assert.equal(words.bug, 2);
});

test("top repos and language aggregation by name", () => {
  const s = githubToStats({ user: "x", year: 2026, calendar: cal(2026, { "2026-01-01": 3 }),
    reposByCommits: [{ name: "alpha", count: 30 }, { name: "beta", count: 10 }],
    commits: [{ repo: "alpha", committedDate: "2026-01-01T10:00:00Z", message: "add",
      additions: 1, deletions: 0 }],
    languages: [{ ext: ".ts", count: 100 }, { ext: ".tsx", count: 50 }, { ext: ".map", count: 999 }] });
  assert.deepEqual(s.projects.top_repos[0], { name: "alpha", count: 30 });
  assert.equal(s.projects.repo_count, 2);
  const langs = Object.fromEntries(s.projects.languages.map(l => [l.ext, l.count]));
  assert.equal(langs[".ts"], 100);   // langages restent au format ext ; l'agrégation par NOM se fait au rendu
  assert.equal(langs[".map"], 999);  // githubToStats ne filtre pas ; le filtrage .map se fait côté rendu
});
```

- [ ] **Step 3 : Vérifier l'échec**

Run: `node --test api/github-to-stats.test.js`
Expected: FAIL (`Cannot find module './github-to-stats.js'`).

- [ ] **Step 4 : Implémenter** — `api/github-to-stats.js` (port de la logique d'`analyze.py`)

```js
const STOP = new Set(["the","a","an","and","or","to","of","in","on","for","with",
  "le","la","les","un","une","de","des","du","et","à","en","pour","dans","sur",
  "au","aux","ce","cette","is","it","this"]);
const WORD_RE = /[^\W\d_]{2,}/gu;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

function contributions(calendar, year) {
  const counts = new Map(calendar.map(d => [d.date, d.count]));
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const start = new Date(jan1); start.setUTCDate(1 - ((jan1.getUTCDay()))); // dimanche <= 1er jan
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const end = new Date(dec31); end.setUTCDate(dec31.getUTCDate() + (6 - dec31.getUTCDay()));
  const weeks = [], labels = []; let prevMonth = null;
  for (let d = new Date(start); d <= end;) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = d.toISOString().slice(0, 10);
      week.push(d.getUTCFullYear() === year ? { date: iso, count: counts.get(iso) || 0 } : null);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const first = week.find(c => c);
    if (first) { const m = +first.date.slice(5, 7); if (m !== prevMonth) {
      labels.push({ col: weeks.length, label: MONTHS[m - 1] }); prevMonth = m; } }
    weeks.push(week);
  }
  const max = calendar.reduce((m, d) => Math.max(m, d.count), 0);
  return { weeks, max, month_labels: labels };
}
function volume(calendar, commits) {
  const active = calendar.filter(d => d.count > 0).map(d => d.date).sort();
  let best = active.length ? 1 : 0, cur = active.length ? 1 : 0;
  for (let i = 1; i < active.length; i++) {
    const diff = (Date.parse(active[i]) - Date.parse(active[i - 1])) / 86400000;
    cur = diff === 1 ? cur + 1 : 1; best = Math.max(best, cur);
  }
  const busiest = calendar.reduce((a, b) => b.count > a.count ? b : a, { date: null, count: -1 });
  return { added: commits.reduce((s, c) => s + (c.additions || 0), 0),
    deleted: commits.reduce((s, c) => s + (c.deletions || 0), 0),
    longest_streak: best, active_days: active.length,
    busiest_day: { date: busiest.date, count: Math.max(0, busiest.count) } };
}
function rhythm(commits) {
  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const hours = new Array(24).fill(0), wd = new Array(7).fill(0); let night = 0;
  for (const c of commits) {
    const dt = new Date(c.committedDate);
    const day = (dt.getUTCDay() + 6) % 7, hr = dt.getUTCHours(); // lundi=0
    heatmap[day][hr]++; hours[hr]++; wd[day]++;
    if (hr >= 22 || hr <= 5) night++;
  }
  const argmax = a => a.indexOf(Math.max(...a));
  return { heatmap, peak_hour: commits.length ? argmax(hours) : 0,
    peak_weekday: commits.length ? argmax(wd) : 0,
    night_owl_pct: commits.length ? Math.round(100 * night / commits.length) : 0 };
}
function words(commits) {
  const wc = new Map(), ec = new Map(); let fix = 0, longest = "";
  for (const c of commits) {
    const subj = c.message || "";
    if (subj.toLowerCase().includes("fix")) fix++;
    if (subj.length > longest.length) longest = subj;
    for (const w of subj.toLowerCase().matchAll(WORD_RE))
      if (!STOP.has(w[0])) wc.set(w[0], (wc.get(w[0]) || 0) + 1);
    for (const e of subj.matchAll(EMOJI_RE)) ec.set(e[0], (ec.get(e[0]) || 0) + 1);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { top_words: top(wc, 10).map(([word, count]) => ({ word, count })),
    fix_rate_pct: commits.length ? Math.round(100 * fix / commits.length) : 0,
    longest_subject: longest,
    emojis: top(ec, 5).map(([emoji, count]) => ({ emoji, count })) };
}
function archetype(vol, rhy, langsExt, wrds) {
  const night = rhy.night_owl_pct, fixr = wrds.fix_rate_pct;
  const when = night >= 40 ? "Night Owl" : rhy.peak_hour <= 11 ? "Lève-tôt" : "Diurne";
  const topWords = new Set(wrds.top_words.slice(0, 5).map(w => w.word));
  let craft, tag;
  if (fixr >= 35) [craft, tag] = ["Pompier", "tu éteins plus de feux que tu n'en allumes"];
  else if (topWords.has("refactor")) [craft, tag] = ["Refactoreur", "jamais tranquille tant que ce n'est pas propre"];
  else if (vol.deleted > vol.added) [craft, tag] = ["Sculpteur", "tu tailles dans la masse — moins, c'est mieux"];
  else [craft, tag] = ["Bâtisseur", "brique par brique, tu empiles les lignes"];
  const traits = [night + "% la nuit", "fix " + fixr + "%"];
  if (langsExt[0]) traits.push(langsExt[0].ext);
  return { title: when + " " + craft, tagline: tag, traits };
}

export function githubToStats(input) {
  const { user, year, calendar, reposByCommits, commits, languages } = input;
  const total = calendar.reduce((s, d) => s + d.count, 0);
  const contrib = contributions(calendar, year);
  if (total === 0) {
    return { year, total_commits: 0, empty: true, volume: {}, rhythm: {},
      projects: { top_file: null }, words: {}, contributions: contrib, archetype: {} };
  }
  const vol = volume(calendar, commits);
  const rhy = rhythm(commits);
  const wrds = words(commits);
  const langs = languages.slice().sort((a, b) => b.count - a.count).slice(0, 6);
  const projects = {
    top_repos: reposByCommits.slice(0, 5).map(r => ({ name: r.name, count: r.count })),
    repo_count: reposByCommits.length,
    top_file: null,
    languages: langs.map(l => ({ ext: l.ext, count: l.count })) };
  return { year, total_commits: total, empty: false, volume: vol, rhythm: rhy,
    projects, words: wrds, contributions: contrib,
    archetype: archetype(vol, rhy, langs, wrds) };
}
```

- [ ] **Step 5 : Vérifier le succès**

Run: `node --test api/github-to-stats.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6 : Commit**

```bash
git add package.json api/github-to-stats.js api/github-to-stats.test.js
git commit -m "feat: pure githubToStats transformer with node:test coverage"
```

---

### Task 4 : Client GitHub + handler `api/wrapped`

**Files:**
- Create: `api/github-client.js`, `api/wrapped.js`, `api/wrapped.test.js`

**Interfaces:**
- Consumes: `githubToStats(input)` (Task 3).
- Produces:
  - `graphql(query, variables, token) -> data` (lève sur erreur GraphQL/HTTP).
  - `fetchWrapped(user, year, token) -> input` (l'objet attendu par `githubToStats`).
  - `handler(req, res)` (signature Node/Vercel) : orchestration + codes HTTP.

- [ ] **Step 1 : `api/github-client.js`**

```js
const API = "https://api.github.com/graphql";

export async function graphql(query, variables, token, fetchImpl = fetch) {
  const r = await fetchImpl(API, { method: "POST",
    headers: { Authorization: "bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error("github http " + r.status);
  const j = await r.json();
  if (j.errors) throw new Error("github graphql: " + JSON.stringify(j.errors));
  return j.data;
}

const Q_MAIN = `query($user:String!,$from:DateTime!,$to:DateTime!){
  user(login:$user){ id
    contributionsCollection(from:$from,to:$to){
      totalCommitContributions
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
      commitContributionsByRepository(maxRepositories:8){
        repository{ name } contributions{ totalCount } } }
    repositories(first:100,ownerAffiliations:OWNER,isFork:false){
      nodes{ languages(first:6){ edges{ size node{ name } } } } } } }`;

const Q_HISTORY = `query($owner:String!,$name:String!,$id:ID!,$since:GitTimestamp!,$until:GitTimestamp!,$cursor:String){
  repository(owner:$owner,name:$name){ defaultBranchRef{ target{ ... on Commit{
    history(author:{id:$id},since:$since,until:$until,first:100,after:$cursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ committedDate messageHeadline additions deletions } } } } } } }`;

const NAME_EXT = { JavaScript:".js", TypeScript:".ts", Python:".py", Rust:".rs", Go:".go",
  Java:".java", "C++":".cpp", C:".c", "C#":".cs", Ruby:".rb", PHP:".php", HTML:".html",
  CSS:".css", SCSS:".scss", Shell:".sh", Markdown:".md", Vue:".vue", Kotlin:".kt",
  Swift:".swift", Dart:".dart", "Jupyter Notebook":".ipynb", Lua:".lua" };

export async function fetchWrapped(user, year, token, fetchImpl = fetch) {
  const from = year + "-01-01T00:00:00Z", to = year + "-12-31T23:59:59Z";
  const data = await graphql(Q_MAIN, { user, from, to }, token, fetchImpl);
  if (!data.user) { const e = new Error("user not found"); e.code = 404; throw e; }
  const u = data.user;
  const calendar = u.contributionsCollection.contributionCalendar.weeks
    .flatMap(w => w.contributionDays)
    .map(d => ({ date: d.date, count: d.contributionCount }));
  const reposByCommits = u.contributionsCollection.commitContributionsByRepository
    .map(x => ({ name: x.repository.name, count: x.contributions.totalCount }))
    .sort((a, b) => b.count - a.count);
  const langAgg = new Map();
  for (const repo of u.repositories.nodes)
    for (const e of (repo.languages ? repo.languages.edges : [])) {
      const ext = NAME_EXT[e.node.name] || ("." + e.node.name.toLowerCase().replace(/\W+/g, ""));
      langAgg.set(ext, (langAgg.get(ext) || 0) + e.size);
    }
  const languages = [...langAgg.entries()].map(([ext, count]) => ({ ext, count }));
  const commits = [];
  for (const r of reposByCommits.slice(0, 8)) {
    let cursor = null, pages = 0;
    do {
      const h = await graphql(Q_HISTORY,
        { owner: user, name: r.name, id: u.id, since: from, until: to, cursor }, token, fetchImpl);
      const hist = h.repository && h.repository.defaultBranchRef
        && h.repository.defaultBranchRef.target && h.repository.defaultBranchRef.target.history;
      if (!hist) break;
      for (const n of hist.nodes) commits.push({ repo: r.name, committedDate: n.committedDate,
        message: n.messageHeadline, additions: n.additions, deletions: n.deletions });
      cursor = hist.pageInfo.hasNextPage ? hist.pageInfo.endCursor : null;
    } while (cursor && ++pages < 5);
  }
  return { user, year, calendar, reposByCommits, commits, languages };
}
```

- [ ] **Step 2 : Écrire le test du handler d'abord** — `api/wrapped.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "./wrapped.js";

function res() {
  return { code: 200, body: null, headers: {},
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    json(o) { this.body = o; return this; },
    end(s) { this.body = s; return this; } };
}

test("rejects invalid username (400) before any network", async () => {
  const r = res();
  await handler({ query: { user: "bad name!" } }, r, { token: "t", fetchImpl: () => { throw new Error("no net"); } });
  assert.equal(r.code, 400);
});

test("503 when token missing", async () => {
  const r = res();
  await handler({ query: { user: "octocat" } }, r, { token: "", fetchImpl: () => {} });
  assert.equal(r.code, 503);
});

test("404 when github reports no user", async () => {
  const r = res();
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: { user: null } }) });
  await handler({ query: { user: "ghost" } }, r, { token: "t", fetchImpl: fakeFetch });
  assert.equal(r.code, 404);
});
```

- [ ] **Step 3 : Vérifier l'échec**

Run: `node --test api/wrapped.test.js`
Expected: FAIL (`Cannot find module './wrapped.js'`).

- [ ] **Step 4 : Implémenter** — `api/wrapped.js`

```js
import { fetchWrapped } from "./github-client.js";
import { githubToStats } from "./github-to-stats.js";

const USER_RE = /^[a-zA-Z0-9-]{1,39}$/;

export async function handler(req, res, opts = {}) {
  const token = opts.token !== undefined ? opts.token : process.env.GITHUB_TOKEN;
  const fetchImpl = opts.fetchImpl || fetch;
  const user = (req.query && req.query.user || "").trim();
  const year = +(req.query && req.query.year) || new Date().getFullYear();
  if (!USER_RE.test(user)) return res.status(400).json({ error: "invalid username" });
  if (!token) return res.status(503).json({ error: "server not configured" });
  try {
    const input = await fetchWrapped(user, year, token, fetchImpl);
    const stats = githubToStats(input);
    res.setHeader("Cache-Control", "public, max-age=600");
    return res.status(200).json(stats);
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: "user not found" });
    return res.status(503).json({ error: "upstream error" });
  }
}

export default handler;
```

- [ ] **Step 5 : Vérifier le succès + toute la suite Node**

Run: `node --test api/`
Expected: PASS (tous les tests des deux fichiers).

- [ ] **Step 6 : Commit**

```bash
git add api/github-client.js api/wrapped.js api/wrapped.test.js
git commit -m "feat: GitHub GraphQL client and /api/wrapped handler with error codes"
```

---

### Task 5 : Config Vercel + intégration + README

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `web/` (statique) et `api/wrapped.js` (fonction).

- [ ] **Step 1 : `vercel.json`**

```json
{
  "functions": { "api/wrapped.js": { "runtime": "nodejs20.x" } },
  "rewrites": [{ "source": "/", "destination": "/web/index.html" }],
  "cleanUrls": true
}
```

- [ ] **Step 2 : Documenter dans `README.md`** — ajouter une section :

````markdown
## App web (pseudo GitHub)

Déploiement Vercel :
1. Importer le repo dans Vercel.
2. Variable d'environnement **`GITHUB_TOKEN`** = un token GitHub en lecture
   seule (scope `public_repo` / `read:user` suffit ; sert à lire des données
   publiques via GraphQL).
3. Déployer. L'accueil sert `web/index.html` ; l'API est `GET /api/wrapped?user=<login>&year=<YYYY>`.

Le CLI local reste disponible : `python git_wrapped.py <racines> --year <YYYY> -o out.html`.

### Tests
```bash
python -m unittest discover -s tests   # CLI (Python)
node --test api/                        # backend (Node)
```
````

- [ ] **Step 3 : Vérifier les deux suites**

Run:
```bash
python -m unittest discover -s tests 2>&1 | tail -1
node --test api/ 2>&1 | tail -3
```
Expected : les deux vertes.

- [ ] **Step 4 : Commit**

```bash
git add vercel.json README.md
git commit -m "chore: Vercel config and web-app documentation"
```

---

## Self-Review

**Spec coverage :**
- Contrat partagé → Global Constraints + Task 3 (`githubToStats` produit exactement les clés). ✓
- Frontend story partagé (extraction + `renderWrapped`) → Task 1. ✓
- CLI conservé, `render.py` refactoré pour inliner → Task 1. ✓
- Accueil pseudo + fetch → Task 2. ✓
- Backend GraphQL hybride (contributionsCollection + historiques top repos + langages) → Task 4 (`fetchWrapped`). ✓
- Calculs (streak, heures, mots, lignes, archétype, agrégation) → Task 3 (port d'`analyze.py`). ✓
- `top_file: null` → Task 3 (empty + non-empty). ✓
- Erreurs 400/404/503, regex pseudo, token serveur, cache → Task 4. ✓
- Sécu token serveur only → Global Constraints + Task 4 (`process.env`, jamais renvoyé). ✓
- Hébergement Vercel → Task 5. ✓
- Tests : transformateur sur fixtures, cas d'erreur, suites Python conservées → Tasks 1/3/4/5. ✓

**Placeholder scan :** aucun TBD/TODO ; le refactor de Task 1 est décrit comme une transformation mécanique précise (déplacement de code existant), pas un « à compléter ».

**Type consistency :** `githubToStats(input)` — `input` (calendar/reposByCommits/commits/languages) identique entre Task 3 (définition/tests) et Task 4 (`fetchWrapped` le produit). Le contrat de sortie (`volume/rhythm/projects/words/contributions/archetype`) correspond à ce que `web/wrapped.js` (Task 1) consomme, hérité d'`analyze`. `handler(req,res,opts)` cohérent entre Task 4 (def) et ses tests. `renderWrapped(mount, S)` cohérent entre Task 1 (def) et Task 2 (appel).
