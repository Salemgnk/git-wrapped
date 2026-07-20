# Git Wrapped — Design

**Date:** 2026-07-21
**Statut:** validé, prêt pour plan d'implémentation

## But

Une commande CLI qui scanne un ou plusieurs dossiers racines, découvre tous les
dépôts git dessous, agrège les commits d'une année pour un auteur donné, et
génère une **page HTML autonome** à faire défiler façon *Spotify Wrapped*.

Contraintes clés :
- **Python, stdlib uniquement** — zéro dépendance à installer.
- **Sortie = un seul fichier `.html`** (CSS + JS + données inline, aucune
  ressource externe), partageable tel quel.
- Périmètre : **multi-repos, filtré sur un auteur, une année.**

## Utilisation

```
python git_wrapped.py <racine> [<racine>...] [options]
```

Exemple :
```
python git_wrapped.py ~/Documents/Perso ~/code \
    --year 2026 \
    --author kossi.upsilon@gmail.com \
    -o wrapped.html
```

Options :
- `<racine>...` : 1+ dossiers scannés récursivement. Un dépôt = dossier
  contenant `.git`.
- `--year` : année couverte. Défaut = année courante.
- `--author` : filtre par email git. Défaut = `git config user.email`.
- `-o` / `--output` : fichier de sortie. Défaut = `git-wrapped-<year>.html`.

## Architecture

Python, stdlib uniquement. Quatre modules à responsabilité unique + un
orchestrateur CLI. Chaque module est testable isolément.

### 1. `discover.py`
Trouve les dépôts git sous les racines.
- Parcours récursif ; un dossier contenant `.git` est un dépôt.
- **N'entre pas** dans un dépôt déjà détecté (pas de sous-modules doublonnés)
  ni dans `node_modules`, `.venv`, etc.
- **Entrée :** `list[str]` (racines). **Sortie :** `list[Path]` (repos).
- **Dépend de :** filesystem uniquement.

### 2. `collect.py`
Extrait les commits normalisés d'un dépôt.
- Lance `git log` avec un format machine :
  `--pretty=%H%x1f%an%x1f%ae%x1f%aI%x1f%s` + `--numstat`, filtré par
  `--since`/`--until` (bornes de l'année) et `--author`.
- Parse la sortie en `list[Commit]`.
- **`Commit`** (dataclass) : `hash`, `author_name`, `author_email`,
  `datetime` (aware, local), `subject`, `repo` (nom), `added`, `deleted`,
  `files` (list[str]).
- Lignes `-` de `--numstat` (binaires/merges) → 0.
- **Entrée :** `Path`, `year`, `author`. **Sortie :** `list[Commit]`.
- **Dépend de :** binaire `git`, module `subprocess`.

### 3. `analyze.py`
Cœur logique, **pur, sans I/O**. Prend `list[Commit]` → `dict` de stats.
Un calcul par carte du Wrapped :

- **Volume & streaks** : total commits, lignes ajoutées/supprimées, plus
  longue série de jours consécutifs avec au moins un commit, jour le plus
  productif (date + nombre).
- **Rythme & horaires** : matrice 7×24 (jour de semaine × heure) pour la
  heatmap ; score « night owl vs early bird » (part des commits 22h–5h) ;
  heure de pointe ; répartition par jour de semaine.
- **Projets** : top repos par commits, fichier le plus modifié (chemin +
  occurrences), langages dominants par extension de fichier.
- **Mots & humeur** : mots les plus fréquents dans les messages (stop-words
  FR/EN filtrés), taux de commits contenant « fix », message le plus long,
  emojis utilisés (comptés).

- **Entrée :** `list[Commit]`, `year`. **Sortie :** `dict` sérialisable.
- **Dépend de :** stdlib pure (`collections`, `datetime`, `re`).

### 4. `render.py`
Génère le HTML.
- Injecte le `dict` stats dans un **template HTML inline** (CSS + JS vanilla).
- **Tout inline** : aucune ressource externe → fichier autoportant.
- Écrit le fichier de sortie.
- **Entrée :** `dict` stats, `output_path`. **Sortie :** fichier écrit.

### Orchestrateur : `git_wrapped.py`
CLI (`argparse`) qui enchaîne : `discover` → `collect` (par repo, fusionné)
→ `analyze` → `render`. Gère les options, les valeurs par défaut, les
avertissements.

## Rendu HTML

- Suite de **cartes plein écran** (`scroll-snap`), une stat par carte,
  navigation molette / flèches / scroll.
- Thème **sombre** par défaut, dégradés, gros chiffres animés à l'apparition
  (IntersectionObserver + CSS).
- Heatmap 7×24 en grille CSS.
- Une carte de titre (« Ton année en code — 2026 ») et une carte de clôture
  récapitulative.

## Erreurs & cas limites

- **Aucun repo trouvé** ou **aucun commit sur l'année/auteur** → page « année
  vide » propre, message amical, pas de crash.
- **Repo sans commits**, **dossier illisible**, **`git` absent d'un repo** →
  skip avec avertissement sur stderr, on continue les autres.
- **`git` introuvable dans le PATH** → erreur claire en amont.
- **`--numstat` avec `-`** (binaires/merges) → comptés comme 0 ligne.
- Fuseaux horaires : on utilise l'heure locale du commit (`%aI` → datetime
  aware convertie en local) pour que « night owl » ait du sens.

## Tests

- **`analyze.py`** : tests unitaires sur des `list[Commit]` fabriquées —
  streaks, heatmap, top mots, night-owl. C'est le cœur logique, pur donc
  facile et rapide à couvrir.
- **`collect.py`** : test sur un petit dépôt git temporaire créé dans le test
  (quelques commits scriptés), vérifie le parsing.
- `discover.py` : test sur une arbo temporaire avec repos imbriqués et
  `node_modules`.

## Hors périmètre (YAGNI)

- Pas de multi-auteurs / leaderboard.
- Pas de comparaison inter-années.
- Pas d'export image/PDF.
- Pas de serveur web ni de dépendances externes.
- Pas d'intégration API (GitHub/GitLab) : local uniquement.

Juste : **scan → HTML.**
