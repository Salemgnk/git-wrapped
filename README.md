# Git Wrapped

Ton année GitHub en story façon *Spotify Wrapped* · Your GitHub year, wrapped like *Spotify Wrapped*.

**→ Démo / Live demo : [git-wrapped-teal.vercel.app](https://git-wrapped-teal.vercel.app)**

[🇫🇷 Français](#-français) · [🇬🇧 English](#-english)

![La page d'accueil](docs/screenshots/landing.png)

![Aperçu des cartes](docs/screenshots/cards.png)

---

## 🇫🇷 Français

Ton année GitHub transformée en story façon *Spotify Wrapped* : commits, plus
longue série, rythme, langages, mot fétiche et ton **archétype de dev** — 10
cartes à partager, export PNG inclus.

### Fonctionnalités

- **10 cartes** animées : intro, commits, rythme + calendrier de contributions,
  série la plus longue, lignes ajoutées/supprimées, top projet, top langage,
  mot de commit fétiche, archétype de dev, récap.
- **Quiz** : devine ton dépôt et ton mot n°1 avant la révélation.
- **Défilement auto** (~5 s/carte) avec play/pause, **musique** chiptune générée
  (ou un `web/music.mp3` déposé), navigation clavier / tap / swipe.
- **Export PNG** fidèle de chaque carte (SVG natif, polices embarquées) +
  partage natif.
- **Archétype** déterministe : 6 créneaux × 9 métiers (« Créature Nocturne
  Pompier », « Diurne Bâtisseur »…).
- **Deux fronts, une seule story** : le CLI Python et l'app web partagent le même
  moteur de rendu (`web/wrapped.js` + `web/wrapped.css`) et le même contrat de
  stats ; seule la source de données change.

### App web (pseudo GitHub)

L'app affiche le wrapped des **dépôts publics** d'un pseudo GitHub : on tape un
login, un backend interroge l'API GitHub GraphQL et calcule les stats **à partir
des commits publics uniquement** (aucune fuite d'activité privée).

#### Déploiement (Vercel)

1. Importer le repo dans Vercel (ou `vercel --prod`).
2. Variable d'environnement **`GITHUB_TOKEN`** = un token GitHub en lecture seule
   (scope `read:user` / `public_repo` suffit ; sert à lire du public via GraphQL).
3. Déployer. L'accueil sert `web/index.html` ; l'API est
   `GET /api/wrapped?user=<login>&year=<YYYY>` (année par défaut = année courante).

> Le token reste **côté serveur** (variable d'env Vercel) et n'est jamais exposé
> au client. L'app ne montre que des données publiques.

#### Self-host (sans Vercel)

Pas besoin de Vercel : un serveur Node **zéro dépendance** sert l'app et l'API, et
relance le classement tout seul.

```bash
GITHUB_TOKEN=ghp_xxx node server.js        # -> http://localhost:3000
PORT=8080 node server.js --no-cron         # port custom, cron désactivé
```

- **Store** : sans `KV_REST_API_URL`, les données du classement sont écrites dans
  `.data/kv.json` (aucun service cloud requis). Vercel KV / Upstash reste supporté.
- **Cron intégré** : recalcul toutes les 6 h (`REFRESH_HOURS` pour changer). L'endpoint
  `/api/cron/refresh` reste dispo pour un cron externe.
- **Classement** : marche pareil ; il te faut juste une **GitHub OAuth App** avec le
  callback `http://<ton-hôte>/api/auth/callback` et les env vars `GITHUB_OAUTH_CLIENT_ID`,
  `GITHUB_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`, `CRON_SECRET`.

### Classement public

Un classement opt-in (2 onglets **Devs** / **Projets** × toggle **Semaine** / **Année**)
alimenté par un cron. On rejoint via **OAuth GitHub** (identité seule, on n'ajoute que
soi-même). Un score composite (commits plafonnés + jours actifs + lignes) est recalculé
chaque nuit et stocké dans Vercel KV ; la page `/classement` lit ce snapshot pré-calculé.

**Mise en place :**
1. Créer une **GitHub OAuth App** (Settings → Developer settings) ; Authorization callback
   URL = `https://<domaine>/api/auth/callback`.
2. Activer **Vercel KV** (Storage) sur le projet.
3. Env vars Vercel : `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
   `SESSION_SECRET` (aléatoire), `CRON_SECRET` (aléatoire). `KV_REST_API_URL` /
   `KV_REST_API_TOKEN` sont injectés par l'intégration KV.
4. Le cron (`vercel.json > crons`) recalcule le classement chaque nuit à 03:00.

### CLI local (tes dépôts git)

Aucune dépendance : Python 3 + git. Scanne tes dépôts locaux et génère un `.html`
autonome (polices embarquées en base64, zéro ressource externe).

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

### Développement

Zéro dépendance npm côté backend (Node ≥ 20, `fetch` natif, `node:test`).

```bash
python -m unittest discover -s tests -v   # CLI (Python, stdlib)
npm test                                   # backend web (Node, node:test)
```

### Structure

```
git_wrapped.py        entrée CLI
gitwrapped/           discover · collect · analyze · render (Python)
lib/                  github-client · github-to-stats (backend web)
api/wrapped.js        fonction serverless (Vercel)
web/                  index.html · wrapped.js · wrapped.css · fonts (story partagée)
tests/ · test/        suites Python · Node
```

### Projet frère & crédits

**[My Claude Wrapped — Arcade Edition](https://github.com/HKafuiEPI/my_claude_wrapped)** par
[@HKafuiEPI](https://github.com/HKafuiEPI) : le même esprit « Wrapped », mais pour ton année
**Claude Code** (façon borne d'arcade rétro). Une **fusion** des deux est en cours — une CLI
unifiée qui résume ton année de dev *code + pairing IA* en une seule page. Merci à lui pour
l'idée et l'inspiration. 🕹️

---

## 🇬🇧 English

Your GitHub year turned into a *Spotify Wrapped*–style story: commits, longest
streak, rhythm, languages, favorite word and your **dev archetype** — 10
shareable cards, PNG export included.

### Features

- **10 animated cards**: intro, commits, rhythm + contribution calendar,
  longest streak, lines added/removed, top project, top language, favorite
  commit word, dev archetype, recap.
- **Quizzes**: guess your repo and your #1 word before the reveal.
- **Auto-play** (~5 s/card) with play/pause, generated **chiptune music** (or a
  dropped-in `web/music.mp3`), keyboard / tap / swipe navigation.
- **Faithful PNG export** of every card (native SVG, embedded fonts) + native
  share.
- **Deterministic archetype**: 6 time-slots × 9 crafts (the app labels are in
  French — e.g. « Créature Nocturne Pompier », « Diurne Bâtisseur »).
- **Two front-ends, one story**: the Python CLI and the web app share the same
  rendering engine (`web/wrapped.js` + `web/wrapped.css`) and the same stats
  contract; only the data source changes.

### Web app (GitHub username)

The app shows the wrapped of a GitHub username's **public repos**: you type a
login, a backend queries the GitHub GraphQL API and computes stats **from public
commits only** (no private-activity leak).

#### Deployment (Vercel)

1. Import the repo into Vercel (or `vercel --prod`).
2. Environment variable **`GITHUB_TOKEN`** = a read-only GitHub token
   (`read:user` / `public_repo` scope is enough; used to read public data via GraphQL).
3. Deploy. The home serves `web/index.html`; the API is
   `GET /api/wrapped?user=<login>&year=<YYYY>` (default year = current year).

> The token stays **server-side** (Vercel env var) and is never exposed to the
> client. The app only shows public data.

#### Self-host (no Vercel)

No Vercel needed: a **zero-dependency** Node server serves the app and the API, and
refreshes the leaderboard on its own.

```bash
GITHUB_TOKEN=ghp_xxx node server.js        # -> http://localhost:3000
PORT=8080 node server.js --no-cron         # custom port, cron off
```

- **Store**: without `KV_REST_API_URL`, leaderboard data is written to `.data/kv.json`
  (no cloud service required). Vercel KV / Upstash still supported.
- **Built-in cron**: recompute every 6h (`REFRESH_HOURS` to change). The
  `/api/cron/refresh` endpoint remains available for an external cron.
- **Leaderboard**: works the same; you just need a **GitHub OAuth App** with callback
  `http://<your-host>/api/auth/callback` and env vars `GITHUB_OAUTH_CLIENT_ID`,
  `GITHUB_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`, `CRON_SECRET`.

### Public leaderboard

An opt-in leaderboard (2 tabs **Devs** / **Projects** × **Week** / **Year** toggle)
fed by a cron. You join via **GitHub OAuth** (identity only, you only add
yourself). A composite score (capped commits + active days + lines) is recomputed
nightly and stored in Vercel KV; the `/classement` page reads this precomputed snapshot.

**Setup:**
1. Create a **GitHub OAuth App** (Settings → Developer settings); Authorization callback
   URL = `https://<domain>/api/auth/callback`.
2. Enable **Vercel KV** (Storage) on the project.
3. Vercel env vars: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
   `SESSION_SECRET` (random), `CRON_SECRET` (random). `KV_REST_API_URL` /
   `KV_REST_API_TOKEN` are injected by the KV integration.
4. The cron (`vercel.json > crons`) recomputes the leaderboard every night at 03:00.

### Local CLI (your git repos)

No dependencies: Python 3 + git. Scans your local repos and generates a
self-contained `.html` (base64-embedded fonts, zero external resources).

```bash
python git_wrapped.py ~/Documents/Perso ~/code \
    --year 2026 \
    --author your.email@example.com \
    -o wrapped.html
```

- `roots`: one or more folders scanned recursively (every git repo underneath is
  included).
- `--year`: covered year (default: current year).
- `--author`: filtered git email (default: `git config user.email`).
- `-o`: output file (default: `git-wrapped-<year>.html`).

Then open the `.html` in a browser and scroll.

### Development

Zero npm dependency on the backend (Node ≥ 20, native `fetch`, `node:test`).

```bash
python -m unittest discover -s tests -v   # CLI (Python, stdlib)
npm test                                   # web backend (Node, node:test)
```

### Structure

```
git_wrapped.py        CLI entry
gitwrapped/           discover · collect · analyze · render (Python)
lib/                  github-client · github-to-stats (web backend)
api/wrapped.js        serverless function (Vercel)
web/                  index.html · wrapped.js · wrapped.css · fonts (shared story)
tests/ · test/        Python · Node suites
```

### Sister project & credits

**[My Claude Wrapped — Arcade Edition](https://github.com/HKafuiEPI/my_claude_wrapped)** by
[@HKafuiEPI](https://github.com/HKafuiEPI): the same "Wrapped" spirit, but for your
**Claude Code** year (retro-arcade style). A **fusion** of the two is in progress — a unified
CLI summarizing your dev year *code + AI pairing* in a single page. Thanks to him for the
idea and inspiration. 🕹️
