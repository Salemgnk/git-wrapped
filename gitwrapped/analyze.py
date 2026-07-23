"""Calcul des statistiques du Wrapped à partir d'une liste de commits (pur)."""

from __future__ import annotations

import re
from collections import Counter
from datetime import date, timedelta

from gitwrapped.collect import Commit

_STOP_WORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
    "le", "la", "les", "un", "une", "de", "des", "du", "et", "à", "en",
    "pour", "dans", "sur", "au", "aux", "ce", "cette", "is", "it", "this",
}
_WORD_RE = re.compile(r"[^\W\d_]{2,}")
_EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF]"
)
_MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
           "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]


def analyze(commits: list[Commit], year: int) -> dict:
    """Renvoie un dict de stats sérialisable à partir des commits de l'année."""
    if not commits:
        return {"year": year, "total_commits": 0, "empty": True,
                "volume": {}, "rhythm": {}, "projects": {}, "words": {},
                "contributions": _contributions([], year), "archetype": {}}
    volume = _volume(commits)
    rhythm = _rhythm(commits)
    projects = _projects(commits)
    words = _words(commits)
    return {
        "year": year,
        "total_commits": len(commits),
        "empty": False,
        "volume": volume,
        "rhythm": rhythm,
        "projects": projects,
        "words": words,
        "contributions": _contributions(commits, year),
        "archetype": _archetype(volume, rhythm, projects, words),
    }


def _when_label(night: int, peak: int) -> str:
    """Créneau horaire dominant (6 profils, du plus nocturne au plus tardif)."""
    if night >= 60:
        return "Créature Nocturne"
    if night >= 40:
        return "Night Owl"
    if peak <= 8:
        return "Lève-tôt"
    if peak <= 11:
        return "Matinal"
    if peak <= 17:
        return "Diurne"
    return "Couche-tard"


def _craft_label(volume: dict, top_words: set, fix: int) -> tuple:
    """Métier de dev déduit des mots de commit et du bilan lignes (9 profils)."""
    if fix >= 35:
        return "Pompier", "tu éteins plus de feux que tu n'en allumes"
    if "refactor" in top_words:
        return "Refactoreur", "jamais tranquille tant que ce n'est pas propre"
    if "merge" in top_words:
        return "Diplomate", "ta vie, c'est réconcilier des branches fâchées"
    if "test" in top_words:
        return "Gardien", "les tests d'abord — les bugs n'ont aucune chance"
    if "docs" in top_words:
        return "Scribe", "tu écris de la doc : espèce en voie de disparition"
    if "wip" in top_words:
        return "Brouillon", "« wip » partout, fini un jour, promis ?"
    if volume["deleted"] > volume["added"] * 1.2:
        return "Sculpteur", "tu tailles dans la masse — moins, c'est mieux"
    if volume["added"] > volume["deleted"] * 3:
        return "Bulldozer", "tu empiles les lignes sans jamais regarder derrière"
    return "Bâtisseur", "brique par brique, tu construis pour durer"


def _archetype(volume: dict, rhythm: dict, projects: dict, words: dict) -> dict:
    """Déduit une 'personnalité de dev' à partir des stats (déterministe)."""
    night = rhythm["night_owl_pct"]
    fix = words["fix_rate_pct"]
    when = _when_label(night, rhythm["peak_hour"])
    top_words = {w["word"] for w in words["top_words"][:5]}
    craft, tagline = _craft_label(volume, top_words, fix)

    lang = projects["languages"][0]["ext"] if projects["languages"] else None
    traits = [f"{night}% la nuit", f"fix {fix}%"]
    if lang:
        traits.append(lang)
    return {"title": f"{when} {craft}", "tagline": tagline, "traits": traits}


def _contributions(commits: list[Commit], year: int) -> dict:
    """Grille de contributions type GitHub : colonnes = semaines (début dimanche),
    lignes = jours (0=dimanche). Les jours hors année valent None."""
    counts: Counter[date] = Counter(
        c.when.date() for c in commits if c.when.year == year
    )
    jan1 = date(year, 1, 1)
    dec31 = date(year, 12, 31)
    # Dimanche <= 1er janvier ; samedi >= 31 décembre. weekday(): lun=0..dim=6.
    start = jan1 - timedelta(days=(jan1.weekday() + 1) % 7)
    end = dec31 + timedelta(days=(6 - (dec31.weekday() + 1) % 7))

    weeks: list[list[dict | None]] = []
    day = start
    while day <= end:
        week: list[dict | None] = []
        for _ in range(7):
            if day.year == year:
                week.append({"date": day.isoformat(), "count": counts.get(day, 0)})
            else:
                week.append(None)
            day += timedelta(days=1)
        weeks.append(week)

    month_labels: list[dict] = []
    prev_month = None
    for col, week in enumerate(weeks):
        first = next((cell for cell in week if cell is not None), None)
        if first is not None:
            month = int(first["date"][5:7])
            if month != prev_month:
                month_labels.append({"col": col, "label": _MONTHS[month - 1]})
                prev_month = month

    return {
        "weeks": weeks,
        "max": max(counts.values(), default=0),
        "month_labels": month_labels,
    }


def _volume(commits: list[Commit]) -> dict:
    added = sum(c.added for c in commits)
    deleted = sum(c.deleted for c in commits)
    per_day: Counter[date] = Counter(c.when.date() for c in commits)
    busiest_date, busiest_count = per_day.most_common(1)[0]
    return {
        "added": added,
        "deleted": deleted,
        "longest_streak": _longest_streak(set(per_day)),
        "busiest_day": {"date": busiest_date.isoformat(), "count": busiest_count},
        "active_days": len(per_day),
    }


def _longest_streak(days: set[date]) -> int:
    if not days:
        return 0
    best = cur = 1
    ordered = sorted(days)
    for prev, nxt in zip(ordered, ordered[1:]):
        if nxt - prev == timedelta(days=1):
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
    return best


def _rhythm(commits: list[Commit]) -> dict:
    heatmap = [[0] * 24 for _ in range(7)]  # [jour de semaine 0=lundi][heure]
    hour_counts: Counter[int] = Counter()
    weekday_counts: Counter[int] = Counter()
    night = 0
    for c in commits:
        wd = c.when.weekday()
        hr = c.when.hour
        heatmap[wd][hr] += 1
        hour_counts[hr] += 1
        weekday_counts[wd] += 1
        if hr >= 22 or hr <= 5:
            night += 1
    peak_hour = hour_counts.most_common(1)[0][0]
    peak_weekday = weekday_counts.most_common(1)[0][0]
    return {
        "heatmap": heatmap,
        "peak_hour": peak_hour,
        "peak_weekday": peak_weekday,
        "night_owl_pct": round(100 * night / len(commits)),
    }


def _projects(commits: list[Commit]) -> dict:
    repo_counts: Counter[str] = Counter(c.repo for c in commits)
    file_counts: Counter[str] = Counter()
    lang_counts: Counter[str] = Counter()
    for c in commits:
        for path in c.files:
            file_counts[path] += 1
            name = path.rsplit("/", 1)[-1]
            dot = name.rfind(".")
            if dot > 0:  # dot exists and is not the leading char -> real extension
                lang_counts[name[dot:].lower()] += 1
    top_file = None
    if file_counts:
        path, count = file_counts.most_common(1)[0]
        top_file = {"path": path, "count": count}
    return {
        "top_repos": [{"name": n, "count": c} for n, c in repo_counts.most_common(5)],
        "repo_count": len(repo_counts),
        "top_file": top_file,
        "languages": [{"ext": e, "count": c} for e, c in lang_counts.most_common(6)],
    }


def _words(commits: list[Commit]) -> dict:
    word_counts: Counter[str] = Counter()
    emoji_counts: Counter[str] = Counter()
    fix = 0
    longest = ""
    for c in commits:
        subject = c.subject
        if "fix" in subject.lower():
            fix += 1
        if len(subject) > len(longest):
            longest = subject
        for w in _WORD_RE.findall(subject.lower()):
            if w not in _STOP_WORDS:
                word_counts[w] += 1
        for e in _EMOJI_RE.findall(subject):
            emoji_counts[e] += 1
    return {
        "top_words": [{"word": w, "count": c} for w, c in word_counts.most_common(10)],
        "fix_rate_pct": round(100 * fix / len(commits)),
        "longest_subject": longest,
        "emojis": [{"emoji": e, "count": c} for e, c in emoji_counts.most_common(5)],
    }
