# Git Wrapped Web — Design

**Date:** 2026-07-22
**Statut:** validé, prêt pour le plan d'implémentation

## But

Transformer Git Wrapped (aujourd'hui un CLI qui lit des dépôts git locaux) en
une **petite app web** : on tape un **pseudo GitHub**, l'app récupère ses
données publiques via l'API GitHub et affiche la story « wrapped » existante.
Le CLI local est **conservé**.

Contrainte structurante : sortir des stats riches (calendrier de
contributions, total commits, top repos) pour *n'importe quel pseudo public*
exige l'**API GraphQL de GitHub**, qui nécessite un **token**. Le REST
non-authentifié (60 req/h, pas d'agrégation) est inutilisable. → backend avec
token serveur.

## Principe central : un contrat de stats partagé

Le `dict` de stats produit par `analyze` devient l'**interface unique**. Sa
forme (inchangée) :

```
{ year, total_commits, empty,
  volume:  {added, deleted, longest_streak, busiest_day:{date,count}, active_days},
  rhythm:  {heatmap[7][24], peak_hour, peak_weekday, night_owl_pct},
  projects:{top_repos:[{name,count}], repo_count, top_file:{path,count}|null,
            languages:[{ext,count}]},
  words:   {top_words:[{word,count}], fix_rate_pct, longest_subject, emojis:[{emoji,count}]},
  contributions:{weeks:[[{date,count}|null]*7]*~53, max, month_labels:[{col,label}]},
  archetype:{title, tagline, traits:[...]} }
```

Deux **sources** produisent ce contrat ; **un seul frontend** le consomme.

## Architecture

Trois parties + un contrat.

### A. Frontend « story » (partagé) — `web/`
On **extrait** le CSS et le JS de la story (aujourd'hui embarqués dans le
gabarit de `render.py`) vers des assets autonomes :

- `web/wrapped.css` — les styles de la story (néo-brutalisme sombre).
- `web/wrapped.js` — le moteur de rendu : `buildSlides`, navigation
  (tap/clavier/swipe), auto-défilement + progression, musique chiptune,
  quizz, partage PNG, count-up, visuels du haut. Il lit un objet `S` (le
  contrat) exposé globalement (`window.WRAPPED_STATS`) et rend le deck dans un
  conteneur donné.
- `web/fonts.css` — les `@font-face` (Space Grotesk / Space Mono) en base64.
- `web/index.html` — page d'accueil : champ **pseudo** (+ année optionnelle),
  bouton « Voir mon wrapped ». À la soumission → appelle `/api/wrapped` →
  injecte le contrat dans `window.WRAPPED_STATS` → lance le rendu.

**Source unique de vérité** : `render.py` (CLI) **lit** `web/wrapped.css`,
`web/fonts.css` et `web/wrapped.js`, les **inline** avec le JSON des stats pour
produire un fichier HTML autonome. Le web charge les mêmes fichiers et fetch
les stats. Aucune duplication de la story.

### B. Backend — `api/wrapped` (fonction serverless, Node)
Endpoint : `GET /api/wrapped?user=<login>&year=<YYYY>` (année défaut = année
courante). Utilise `GITHUB_TOKEN` (variable d'environnement, **jamais**
exposée au client). Étapes :

1. **`contributionsCollection(from,to)`** (GraphQL) pour `user` →
   `contributionCalendar` (semaines/jours), `totalCommitContributions`,
   `commitContributionsByRepository[{repository{name,primaryLanguage},
   contributions.totalCount}]`.
2. **Historique des ~8 top repos** (par nombre de contributions) :
   `repository.defaultBranchRef.target.history(author:{id}, since, until)
   { nodes{committedDate, messageHeadline, additions, deletions} }`
   (paginé, plafonné à ~1000 commits/repo au total) → dérive **heures**
   (night-owl, peak_hour/weekday), **mots** (top_words, fix_rate,
   longest_subject), **lignes** (added/deleted).
3. **Langages** : agrégés par nom depuis `repositories.languages` (ou
   `primaryLanguage`), réutilise la logique de nommage/agrégation
   (.ts+.tsx → TypeScript).
4. **Calcul du contrat** : `contributions.weeks` (depuis le calendrier),
   `volume.longest_streak/active_days/busiest_day` (depuis le calendrier),
   `rhythm` (heures depuis les historiques ; night_owl_pct depuis les
   historiques), `projects.top_repos` (depuis contributionsByRepository),
   `words` et `volume.added/deleted` (depuis les historiques), `archetype`
   (même règle déterministe que le CLI).

**Non disponible à faible coût → abandonné** : `projects.top_file` renvoie
`null`. Le frontend gère déjà `top_file: null`.

### C. CLI (inchangé) — `gitwrapped/`
`discover` / `collect` / `analyze` restent identiques. `render.py` est
**refactoré** pour inliner les assets partagés (`web/wrapped.css`,
`web/fonts.css`, `web/wrapped.js`) au lieu d'un gabarit interne. Comportement
et sortie identiques.

## Flux de données

- **Web** : pseudo → `GET /api/wrapped?user&year` → backend GraphQL → contrat
  JSON → `window.WRAPPED_STATS` → `wrapped.js` rend le deck.
- **CLI** : git local → `analyze` → `render` (inline assets + JSON) → fichier
  HTML autonome.

## Gestion des erreurs

- **Pseudo introuvable** (GraphQL renvoie `user: null`) → 404 →
  message « pseudo introuvable » côté frontend.
- **Aucun commit public sur l'année** → contrat avec `empty: true` → l'état
  « silence radio » existant de la story.
- **Token absent / rate-limit / erreur GitHub** → 503 →
  message « réessaie plus tard ».
- **Pseudo invalide** (ne matche pas la regex GitHub
  `^[a-zA-Z0-9-]{1,39}$`) → 400 avant tout appel API.

## Sécurité

- `GITHUB_TOKEN` **serveur uniquement** ; jamais dans le HTML/JS client.
- Pseudo validé par regex avant tout appel.
- Cache court des réponses par (user, year) (ex. 10 min) pour limiter les
  appels API et le coût.
- Même origine (frontend + `api/` sur le même déploiement) → pas de CORS.

## Hébergement / stack

- **Vercel** : `web/` (statique) + `api/wrapped.js` (fonction Node),
  zéro config. Fonction portable (Cloudflare Functions possible sans
  réécriture majeure). `GITHUB_TOKEN` en variable d'environnement du projet.

## Tests

- **Backend — transformateur** : test unitaire de la fonction
  `githubToStats(graphqlResponses) -> dict`, alimentée par des **fixtures
  JSON** (réponses GraphQL enregistrées), **sans réseau**. Vérifie la forme du
  contrat et les calculs (streak, heures, mots, agrégation langages).
- **Backend — cas d'erreur** : user null → 404 ; regex invalide → 400 ;
  fixture d'erreur GitHub → 503.
- **Contrat partagé** : un exemple de contrat de référence (`fixtures/`)
  validé à la fois contre la sortie d'`analyze` (Python) et la sortie du
  backend (Node) — garantit qu'ils produisent la même forme.
- **CLI** : les tests `analyze`/`collect`/`discover`/`render` existants restent
  verts (le refactor de `render` ne change pas la sortie).

## Périmètre (hors et dans)

**Dans** : app web (accueil pseudo + story), backend `api/wrapped` (GraphQL
hybride), refactor de `render` vers assets partagés, CLI conservé, année
courante par défaut avec « jusqu'ici ».

**Hors (YAGNI)** : comptes/OAuth utilisateur, providers autres que GitHub
(GitLab/Bitbucket), historique multi-années comparé, `top_file`, base de
données/persistance, authentification de l'app.

## Ordre de construction (indicatif)

1. Refactor `render.py` → assets partagés `web/` (CLI produit toujours le même
   HTML). *Livrable testable sans réseau.*
2. `web/index.html` + logique de fetch (contre un contrat mocké d'abord).
3. `api/wrapped` : `githubToStats` (testé sur fixtures) puis le câblage GraphQL.
4. Intégration + déploiement Vercel + gestion d'erreurs.
