const STOP = new Set(["the","a","an","and","or","to","of","in","on","for","with",
  "le","la","les","un","une","de","des","du","et","à","en","pour","dans","sur",
  "au","aux","ce","cette","is","it","this"]);
const WORD_RE = /[^\W\d_]{2,}/gu;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

// Compte des commits publics par jour (dans l'année), depuis les historiques.
function dayCounts(commits, year) {
  const m = new Map();
  for (const c of commits) {
    const iso = new Date(c.committedDate).toISOString().slice(0, 10);
    if (+iso.slice(0, 4) === year) m.set(iso, (m.get(iso) || 0) + 1);
  }
  return m;
}
function contributions(counts, year) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const start = new Date(jan1); start.setUTCDate(1 - jan1.getUTCDay());
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
  const { year, commits, languages } = input;
  const counts = dayCounts(commits, year);
  const contrib = contributions(counts, year);
  const total = commits.length;
  if (total === 0) {
    return { year, total_commits: 0, empty: true, volume: {}, rhythm: {},
      projects: { top_file: null }, words: {}, contributions: contrib, archetype: {} };
  }
  const vol = volume(counts, commits);
  const rhy = rhythm(commits);
  const wrds = words(commits);
  const rp = repos(commits);
  const langs = languages.slice().sort((a, b) => b.count - a.count).slice(0, 6);
  const projects = { top_repos: rp.top, repo_count: rp.count, top_file: null,
    languages: langs.map(l => ({ ext: l.ext, count: l.count })) };
  return { year, total_commits: total, empty: false, volume: vol, rhythm: rhy,
    projects, words: wrds, contributions: contrib,
    archetype: archetype(vol, rhy, langs, wrds) };
}
