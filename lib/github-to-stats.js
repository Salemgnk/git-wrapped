const STOP = new Set(["the","a","an","and","or","to","of","in","on","for","with",
  "le","la","les","un","une","de","des","du","et","à","en","pour","dans","sur",
  "au","aux","ce","cette","is","it","this"]);
const WORD_RE = /[^\W\d_]{2,}/gu;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

// Bornes de période en "YYYY-MM-DD". from/to prioritaires ; sinon dérivés de year.
export function periodBounds({ year, from, to } = {}) {
  if (from && to) return { from: String(from).slice(0, 10), to: String(to).slice(0, 10) };
  const y = year || new Date().getUTCFullYear();
  return { from: y + "-01-01", to: y + "-12-31" };
}

// Fusionne deux entrées wrapped (public + privé) : concatène les commits,
// agrège les langages par extension.
export function mergeWrappedInputs(a, b) {
  const lang = new Map();
  for (const l of [...(a.languages || []), ...(b.languages || [])])
    lang.set(l.ext, (lang.get(l.ext) || 0) + l.count);
  return { commits: [...(a.commits || []), ...(b.commits || [])],
    languages: [...lang.entries()].map(([ext, count]) => ({ ext, count })) };
}

// Compte des commits par jour dans la fenêtre [from, to] (comparaison lexicale ISO).
function dayCounts(commits, from, to) {
  const m = new Map();
  for (const c of commits) {
    const iso = new Date(c.committedDate).toISOString().slice(0, 10);
    if (iso >= from && iso <= to) m.set(iso, (m.get(iso) || 0) + 1);
  }
  return m;
}
function contributions(counts, from, to) {
  const fromD = new Date(from + "T00:00:00Z");
  const start = new Date(fromD); start.setUTCDate(fromD.getUTCDate() - fromD.getUTCDay());
  const toD = new Date(to + "T00:00:00Z");
  const end = new Date(toD); end.setUTCDate(toD.getUTCDate() + (6 - toD.getUTCDay()));
  const weeks = [], labels = []; let prevMonth = null;
  for (let d = new Date(start); d <= end;) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = d.toISOString().slice(0, 10);
      week.push(iso >= from && iso <= to ? { date: iso, count: counts.get(iso) || 0 } : null);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const first = week.find(c => c);
    if (first) { const mo = +first.date.slice(5, 7); if (mo !== prevMonth) {
      labels.push({ col: weeks.length, label: MONTHS[mo - 1] }); prevMonth = mo; } }
    weeks.push(week);
  }
  let max = 0; for (const v of counts.values()) max = Math.max(max, v);
  return { weeks, max, month_labels: labels };
}
function volume(counts, commits) {
  const active = [...counts.keys()].sort();
  let best = active.length ? 1 : 0, cur = active.length ? 1 : 0;
  for (let i = 1; i < active.length; i++) {
    const diff = (Date.parse(active[i]) - Date.parse(active[i - 1])) / 86400000;
    cur = diff === 1 ? cur + 1 : 1; best = Math.max(best, cur);
  }
  let busiest = { date: null, count: 0 };
  for (const [date, count] of counts) if (count > busiest.count) busiest = { date, count };
  return { added: commits.reduce((s, c) => s + (c.additions || 0), 0),
    deleted: commits.reduce((s, c) => s + (c.deletions || 0), 0),
    longest_streak: best, active_days: active.length, busiest_day: busiest };
}
function rhythm(commits) {
  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const hours = new Array(24).fill(0), wd = new Array(7).fill(0); let night = 0;
  for (const c of commits) {
    const dt = new Date(c.committedDate);
    const day = (dt.getUTCDay() + 6) % 7, hr = dt.getUTCHours();
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
// Créneau horaire dominant (6 profils) — miroir exact de _when_label côté Python.
function whenLabel(night, peak) {
  if (night >= 60) return "Créature Nocturne";
  if (night >= 40) return "Night Owl";
  if (peak <= 8) return "Lève-tôt";
  if (peak <= 11) return "Matinal";
  if (peak <= 17) return "Diurne";
  return "Couche-tard";
}
// Métier de dev (9 profils) — miroir exact de _craft_label côté Python.
function craftLabel(vol, topWords, fixr) {
  if (fixr >= 35) return ["Pompier", "tu éteins plus de feux que tu n'en allumes"];
  if (topWords.has("refactor")) return ["Refactoreur", "jamais tranquille tant que ce n'est pas propre"];
  if (topWords.has("merge")) return ["Diplomate", "ta vie, c'est réconcilier des branches fâchées"];
  if (topWords.has("test")) return ["Gardien", "les tests d'abord — les bugs n'ont aucune chance"];
  if (topWords.has("docs")) return ["Scribe", "tu écris de la doc : espèce en voie de disparition"];
  if (topWords.has("wip")) return ["Brouillon", "« wip » partout, fini un jour, promis ?"];
  if (vol.deleted > vol.added * 1.2) return ["Sculpteur", "tu tailles dans la masse — moins, c'est mieux"];
  if (vol.added > vol.deleted * 3) return ["Bulldozer", "tu empiles les lignes sans jamais regarder derrière"];
  return ["Bâtisseur", "brique par brique, tu construis pour durer"];
}
function archetype(vol, rhy, langsExt, wrds) {
  const night = rhy.night_owl_pct, fixr = wrds.fix_rate_pct;
  const when = whenLabel(night, rhy.peak_hour);
  const topWords = new Set(wrds.top_words.slice(0, 5).map(w => w.word));
  const [craft, tag] = craftLabel(vol, topWords, fixr);
  const traits = [night + "% la nuit", "fix " + fixr + "%"];
  if (langsExt[0]) traits.push(langsExt[0].ext);
  return { title: when + " " + craft, tagline: tag, traits };
}

// Répartition public / privé sur les MÊMES commits que total_commits.
// Un commit sans marqueur est public (wrapped public : aucun privé n'y entre).
function commitsSplit(commits) {
  let priv = 0;
  for (const c of commits) if (c.private) priv++;
  return { public: commits.length - priv, private: priv };
}

// Top repos comptés depuis les MÊMES commits (une seule source de vérité).
function repos(commits) {
  const m = new Map();
  for (const c of commits) m.set(c.repo, (m.get(c.repo) || 0) + 1);
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { top: sorted.slice(0, 5).map(([name, count]) => ({ name, count })), count: sorted.length };
}

// Tout est calculé sur les COMMITS PUBLICS (historiques des top repos) : nombres
// cohérents entre eux et aucune fuite d'activité privée.
export function githubToStats(input) {
  const { from, to } = periodBounds(input);
  const { commits, languages } = input;
  const counts = dayCounts(commits, from, to);
  const contrib = contributions(counts, from, to);
  const year = +to.slice(0, 4);
  const period = { from, to };
  const total = commits.length;
  const split = commitsSplit(commits);
  if (total === 0) {
    return { user: input.user, year, period, total_commits: 0, commits_split: split, empty: true,
      volume: {}, rhythm: {}, projects: { top_file: null }, words: {},
      contributions: contrib, archetype: {} };
  }
  const vol = volume(counts, commits);
  const rhy = rhythm(commits);
  const wrds = words(commits);
  const rp = repos(commits);
  const langs = languages.slice().sort((a, b) => b.count - a.count).slice(0, 6);
  const projects = { top_repos: rp.top, repo_count: rp.count, top_file: null,
    languages: langs.map(l => ({ ext: l.ext, count: l.count })) };
  return { user: input.user, year, period, total_commits: total, commits_split: split,
    empty: false, volume: vol, rhythm: rhy, projects, words: wrds, contributions: contrib,
    archetype: archetype(vol, rhy, langs, wrds) };
}
