export const DEV_LINES_CAP = 5000;
export const REPO_LINES_CAP = 20000;
export const ACTIVE_DAY_WEIGHT = 10;
// Un repo doit avoir au moins ce nombre de commits (dans la fenêtre) pour figurer
// au classement Projets — écarte les repos à 1-2 commits (README de profil, etc.).
export const MIN_REPO_COMMITS = 3;

const isEmpty = (c) => (c.additions || 0) === 0 && (c.deletions || 0) === 0;

export function filterWindow(commits, window, now, year) {
  return commits.filter((c) => {
    if (isEmpty(c)) return false;
    const t = Date.parse(c.committedDate);
    if (Number.isNaN(t)) return false;
    if (window === "week") return t >= now - 7 * 86400 * 1000 && t <= now;
    return new Date(t).getUTCFullYear() === year;
  });
}

function common(commits, linesCap) {
  const days = new Set(commits.map((c) => c.committedDate.slice(0, 10))).size;
  const lignes = Math.min(
    commits.reduce((s, c) => s + (c.additions || 0) + (c.deletions || 0), 0),
    linesCap,
  );
  return { commits: commits.length, joursActifs: days, lignes };
}

export function devScore(commits) {
  const detail = common(commits, DEV_LINES_CAP);
  return { score: detail.commits + detail.joursActifs * ACTIVE_DAY_WEIGHT + Math.floor(detail.lignes / 100), detail };
}

export function repoScore(commits) {
  const detail = common(commits, REPO_LINES_CAP);
  return { score: detail.commits + detail.joursActifs * ACTIVE_DAY_WEIGHT + Math.floor(detail.lignes / 100), detail };
}
