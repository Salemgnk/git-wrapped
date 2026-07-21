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

## Tests

```bash
python -m unittest discover -s tests -v
```
