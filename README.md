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

## App web (pseudo GitHub)

En plus du CLI local, une app web affiche le wrapped des **dépôts publics**
d'un pseudo GitHub. La story (CSS/JS) est partagée avec le CLI ; seule la
source de données change (API GitHub GraphQL via un backend).

Déploiement Vercel :
1. Importer le repo dans Vercel.
2. Variable d'environnement **`GITHUB_TOKEN`** = un token GitHub en lecture
   seule (scope `read:user` / `public_repo` suffit ; sert à lire des données
   publiques via GraphQL).
3. Déployer. L'accueil sert `web/index.html` ; l'API est
   `GET /api/wrapped?user=<login>&year=<YYYY>` (année défaut = année courante).

Le CLI local reste disponible (voir *Utilisation* ci-dessus).

## Tests

```bash
python -m unittest discover -s tests -v   # CLI (Python)
npm test                                   # backend web (Node, node:test)
```
