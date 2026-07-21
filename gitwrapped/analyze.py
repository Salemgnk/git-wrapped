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
_WORD_RE = re.compile(r"[a-zA-Zà-ÿ]{2,}")
_EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF]"
)


def analyze(commits: list[Commit], year: int) -> dict:
    """Renvoie un dict de stats sérialisable à partir des commits de l'année."""
    if not commits:
        return {"year": year, "total_commits": 0, "empty": True,
                "volume": {}, "rhythm": {}, "projects": {}, "words": {}}
    return {
        "year": year,
        "total_commits": len(commits),
        "empty": False,
        "volume": _volume(commits),
        "rhythm": _rhythm(commits),
        "projects": _projects(commits),
        "words": _words(commits),
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
            dot = path.rfind(".")
            slash = path.rfind("/")
            if dot > slash and dot != -1:
                lang_counts[path[dot:].lower()] += 1
    top_file = None
    if file_counts:
        path, count = file_counts.most_common(1)[0]
        top_file = {"path": path, "count": count}
    return {
        "top_repos": [{"name": n, "count": c} for n, c in repo_counts.most_common(5)],
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
