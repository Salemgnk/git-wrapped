"""Génération d'une page HTML autonome : story portrait façon Spotify Wrapped."""

from __future__ import annotations

import base64
import json
from pathlib import Path

_ASSETS = Path(__file__).parent / "assets"
_FONTS = [
    ("Grotesk", 500, "SpaceGrotesk-500.woff2"),
    ("Grotesk", 700, "SpaceGrotesk-700.woff2"),
    ("SpMono", 700, "SpaceMono-700.woff2"),
]


def _font_faces() -> str:
    """Construit les @font-face avec les woff2 embarqués en base64 (autonome)."""
    faces = []
    for family, weight, fname in _FONTS:
        data = base64.b64encode((_ASSETS / fname).read_bytes()).decode()
        faces.append(
            "@font-face{font-family:'" + family + "';font-style:normal;font-weight:"
            + str(weight) + ";font-display:swap;src:url(data:font/woff2;base64,"
            + data + ") format('woff2');}"
        )
    return "".join(faces)

_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Git Wrapped __YEAR__</title>
<style>
__FONTS__
:root {
  --lime: #C6FF3D; --magenta: #FF2E97; --violet: #7C3AED;
  --cobalt: #2C5CF2; --coral: #FF5A36; --ink: #0B0B0F; --paper: #F4F4F0;
  --mono: "SpMono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: "Grotesk", "Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body { background:
  radial-gradient(1100px 760px at 50% -12%, #1c1c26 0%, #0a0a0e 62%);
  color: var(--paper); font-family: var(--sans); -webkit-font-smoothing: antialiased;
  display: flex; align-items: center; justify-content: center; overflow: hidden; }

.phone { position: relative; width: min(100vw, 452px); height: min(100dvh, 864px);
  border-radius: 34px; overflow: hidden; container-type: size;
  box-shadow: 0 50px 130px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.05);
  user-select: none; }
.phone::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 4;
  opacity: .4; mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"); }
@media (max-width: 500px) {
  .phone { width: 100vw; height: 100dvh; border-radius: 0; box-shadow: none; }
}

.slide { position: absolute; inset: 0; display: flex; flex-direction: column;
  padding: 8cqh 7cqw 9cqh; opacity: 0; pointer-events: none; transform: scale(.985);
  overflow: hidden;
  background: linear-gradient(155deg, var(--base), var(--deep));
  transition: opacity .34s ease, transform .46s cubic-bezier(.2,.72,.2,1); }
.slide.active { opacity: 1; pointer-events: auto; transform: none; }
.slide.top { justify-content: flex-start; } .slide.center { justify-content: center; }
.slide.bottom { justify-content: flex-end; }
.slide > * { position: relative; z-index: 2; }
.slide::before { content: ""; position: absolute; z-index: 0; width: 62cqh; height: 62cqh;
  border-radius: 50%; background: var(--shape); top: -22cqh; right: -20cqh;
  opacity: .9; pointer-events: none; will-change: transform;
  animation: floatA 24s ease-in-out infinite alternate; }
.slide::after { content: ""; position: absolute; z-index: 0; width: 26cqh; height: 26cqh;
  border-radius: 50%; border: 2cqh solid var(--shape); bottom: -8cqh; left: -9cqh;
  opacity: .5; pointer-events: none; will-change: transform;
  animation: floatB 19s ease-in-out infinite alternate; }
@keyframes floatA { from { transform: translate(0,0) rotate(0deg) scale(1); }
  to { transform: translate(-9%, 6%) rotate(20deg) scale(1.07); } }
@keyframes floatB { from { transform: translate(0,0) rotate(0deg) scale(1); }
  to { transform: translate(12%, -9%) rotate(-26deg) scale(1.14); } }
.echo { position: absolute; z-index: 1; top: 30cqh; left: -4cqw; font-family: var(--mono);
  font-weight: 700; font-size: 30cqh; line-height: .74; letter-spacing: -.06em;
  white-space: nowrap; color: transparent; -webkit-text-stroke: 1.4px currentColor;
  opacity: .09; pointer-events: none; }

.s-lime { --base: #C6FF3D; --deep: #A6E800; --shape: #7C3AED; color: var(--ink); --acc: #0a7a00; }
.s-magenta { --base: #FF2E97; --deep: #D40077; --shape: #2C5CF2; color: var(--ink); --acc: #55002a; }
.s-violet { --base: #7C3AED; --deep: #571BB8; --shape: #C6FF3D; color: var(--paper); --acc: var(--lime); }
.s-cobalt { --base: #2C5CF2; --deep: #143DC9; --shape: #C6FF3D; color: var(--paper); --acc: var(--lime); }
.s-coral { --base: #FF5A36; --deep: #E13810; --shape: #7C3AED; color: var(--ink); --acc: #5c1600; }
.s-ink { --base: #12121A; --deep: #08080B; --shape: #7C3AED; color: var(--paper); --acc: #39d353; }

.eyebrow { font-size: 2.5cqh; letter-spacing: .18em; text-transform: uppercase;
  font-weight: 800; opacity: .8; font-family: var(--mono); }
.eyebrow::before { content: "› "; opacity: .6; }
.big { font-family: var(--mono); font-weight: 700; line-height: .84;
  letter-spacing: -.045em; font-size: min(20cqh, 27cqw); white-space: nowrap; }
.big.m { font-size: min(13cqh, 16cqw); white-space: normal; word-break: break-word;
  line-height: .92; }
.big.s { font-size: 8.5cqh; white-space: normal; word-break: break-word; line-height: .96; }
.cursor { display: inline-block; width: .12em; height: .82em; margin-left: .06em;
  background: currentColor; vertical-align: baseline; animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.tag { font-size: 4.6cqh; font-weight: 800; letter-spacing: -.02em; line-height: 1.02;
  max-width: 16ch; }
.note { font-size: 2.5cqh; font-weight: 600; opacity: .82; max-width: 30ch;
  line-height: 1.35; }
.gap { height: 3cqh; } .gap.lg { height: 5cqh; }
.pos { color: var(--acc); } .s-violet .pos, .s-cobalt .pos, .s-ink .pos { color: var(--lime); }
.neg { color: var(--coral); } .s-coral .neg { color: var(--ink); }

.list { display: flex; flex-direction: column; gap: 1.4cqh; font-size: 2.9cqh;
  font-weight: 700; }
.list .li { display: flex; align-items: baseline; gap: 2.4cqw; }
.list .rk { font-family: var(--mono); opacity: .5; min-width: 1.6em; }
.list .nm { font-family: var(--mono); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
.list .ct { margin-left: auto; opacity: .7; font-variant-numeric: tabular-nums;
  font-family: var(--mono); }

.badges { display: flex; flex-wrap: wrap; gap: 1.6cqw; }
.badge { font-family: var(--mono); font-size: 2.3cqh; font-weight: 700;
  padding: .5em .8em; border-radius: 999px; background: rgba(0,0,0,.14);
  border: 1px solid currentColor; }
.s-ink .badge { background: rgba(255,255,255,.06); }

.cal { display: flex; gap: .32cqw; }
.cal .wk { display: flex; flex-direction: column; gap: .32cqw; }
.cal .cell { width: 1.35cqw; aspect-ratio: 1; border-radius: 1px; background: #161b22; }

.bars { position: absolute; top: 2.4cqh; left: 5cqw; right: 5cqw; z-index: 6;
  display: flex; gap: 1.4cqw; }
.bars i { flex: 1; height: 3px; border-radius: 3px; background: rgba(255,255,255,.3); }
.bars i.done { background: #fff; }
.bars.dark i { background: rgba(11,11,15,.24); } .bars.dark i.done { background: #0B0B0F; }

.share { position: absolute; bottom: 3.4cqh; left: 50%; transform: translateX(-50%);
  z-index: 6; border: 1px solid currentColor; background: transparent; color: inherit;
  cursor: pointer; font-family: var(--mono); font-weight: 700; font-size: 2.1cqh;
  padding: .55em 1.1em; border-radius: 999px; opacity: .82; }
.share:hover { opacity: 1; } .share:focus-visible { outline: 2px solid; outline-offset: 3px; }
.hint { position: absolute; bottom: 3.6cqh; right: 6cqw; z-index: 5; font-family: var(--mono);
  font-size: 2cqh; opacity: .5; font-weight: 700; animation: bob 1.8s ease-in-out infinite; }
@keyframes bob { 50% { transform: translateX(4px); } }

.dl { align-self: center; margin-top: 3cqh; border: none; cursor: pointer;
  background: var(--lime); color: var(--ink); font-family: var(--sans); font-weight: 800;
  font-size: 2.6cqh; padding: 1em 1.8em; border-radius: 999px; }
.dl:active { transform: translateY(1px); }
.poster { align-self: center; width: 84%; background: #0d0d12; border: 1px solid #24242c;
  border-radius: 18px; padding: 4cqh 5cqw; display: flex; flex-direction: column; gap: 1.4cqh; }
.poster .pe { font-family: var(--mono); font-size: 2cqh; letter-spacing: .22em;
  text-transform: uppercase; font-weight: 800; color: var(--lime); }
.poster .py { font-family: var(--mono); font-weight: 700; font-size: 9cqh; line-height: .9; }
.poster .pstat { display: flex; justify-content: space-between; align-items: baseline;
  border-top: 1px solid #23232a; padding-top: 1.1cqh; font-size: 2.2cqh; font-weight: 700; }
.poster .pstat .pn { font-family: var(--mono); color: var(--lime); }

.reveal { opacity: 0; transform: translateY(16px); }
.slide.active .reveal { opacity: 1; transform: none;
  transition: opacity .5s ease, transform .55s cubic-bezier(.2,.75,.2,1); }
@media (prefers-reduced-motion: reduce) {
  .slide, .reveal, .slide.active .reveal { transition: none; }
  .cursor, .hint, .slide::before, .slide::after { animation: none; }
}
</style>
</head>
<body>
<div class="phone" id="phone">
  <div class="bars" id="bars"></div>
  <div class="deck" id="deck"></div>
</div>
<script id="data" type="application/json">__DATA__</script>
<script>
const S = JSON.parse(document.getElementById("data").textContent);
const deck = document.getElementById("deck");
const phone = document.getElementById("phone");
const DAYS = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const fmt = n => (n == null ? "0" : n.toLocaleString("fr-FR"));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PAL = { lime:["#C6FF3D","#0B0B0F","#0a7a00"], magenta:["#FF2E97","#0B0B0F","#6a0033"],
  violet:["#7C3AED","#F4F4F0","#C6FF3D"], cobalt:["#2C5CF2","#F4F4F0","#C6FF3D"],
  coral:["#FF5A36","#0B0B0F","#7a1f00"], ink:["#0B0B0F","#F4F4F0","#39d353"] };

function el(t, c, x) { const e = document.createElement(t);
  if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function rv(node, i) { node.classList.add("reveal");
  node.style.transitionDelay = (0.07 * i) + "s"; return node; }

// ---- specs ----
const SPECS = [];
SPECS.push({ bg:"lime", align:"center", eyebrow:"2026 / git wrapped",
  big:S.year, cursor:true, tag:"Ton année en code.", intro:true });

if (!S.empty) {
  SPECS.push({ bg:"magenta", align:"bottom", eyebrow:"cette année tu as poussé",
    big:S.total_commits, count:true, tag:"commits",
    note:"sur "+fmt(S.volume.active_days)+" jours actifs, dans "+fmt(S.projects.repo_count)+" dépôts." });

  SPECS.push({ bg:"ink", align:"center",
    eyebrow:(S.rhythm.night_owl_pct>=40?"créature de la nuit":"à la lumière du jour"),
    tag:"Tu codes surtout vers "+S.rhythm.peak_hour+"h, le "+DAYS[S.rhythm.peak_weekday]+".",
    grid:true, note:S.rhythm.night_owl_pct+"% de tes commits tombent entre 22h et 5h." });

  SPECS.push({ bg:"coral", align:"bottom", eyebrow:"ta plus longue série",
    big:S.volume.longest_streak, count:true, tag:"jours d'affilée",
    note:"record : "+S.volume.busiest_day.count+" commits le "+S.volume.busiest_day.date+"." });

  SPECS.push({ bg:"violet", align:"center", eyebrow:"le bilan des dégâts",
    lines:{added:S.volume.added, deleted:S.volume.deleted},
    note:"lignes ajoutées, lignes supprimées." });

  SPECS.push({ bg:"cobalt", align:"bottom", eyebrow:"ton obsession de l'année",
    big:S.projects.top_repos[0].name, bigClass:"m", tag:"ton dépôt n°1",
    list:S.projects.top_repos.map(r=>({nm:r.name, ct:r.count})) });

  SPECS.push({ bg:"lime", align:"bottom", eyebrow:"ton langage de "+S.year,
    big:S.projects.languages[0].ext,
    list:S.projects.languages.map(l=>({nm:l.ext, ct:l.count})) });

  const w0 = S.words.top_words[0];
  SPECS.push({ bg:"magenta", align:"bottom", eyebrow:"ton mot fétiche",
    big:w0.word, bigClass:"m", tag:"écrit "+fmt(w0.count)+" fois",
    note:"Taux de « fix » : "+S.words.fix_rate_pct+"%."+
      (S.words.emojis.length?"  Tes emojis : "+S.words.emojis.map(e=>e.emoji).join(" "):"") });

  if (S.archetype && S.archetype.title)
    SPECS.push({ bg:"ink", align:"center", eyebrow:"ta personnalité de dev",
      arch:S.archetype });

  SPECS.push({ bg:"ink", align:"center", poster:true, eyebrow:"c'est ton wrap" });
}

// ---- DOM render ----
SPECS.forEach((sp, i) => deck.appendChild(renderSlide(sp, i)));

function renderSlide(sp, i) {
  const s = el("section", "slide s-" + sp.bg + " " + (sp.align || "center"));
  s.dataset.dark = (sp.bg === "lime" || sp.bg === "coral") ? "1" : "0";
  let n = 0;
  const add = node => { s.appendChild(rv(node, n++)); };

  if (!sp.poster) {
    let echo = sp.echo;
    if (!echo) {
      if (sp.big != null) echo = String(sp.big);
      else if (sp.arch) echo = sp.arch.title.split(" ")[0];
      else if (sp.grid) echo = S.rhythm.peak_hour + "h";
      else if (sp.lines) echo = "±";
    }
    if (echo) s.appendChild(el("div", "echo", echo));
  }

  if (sp.eyebrow) add(el("div", "eyebrow", sp.eyebrow));

  if (sp.lines) {
    add(el("div", "gap"));
    const a = el("div", "big m"); a.appendChild(el("span", "pos", "+" + fmt(sp.lines.added)));
    const d = el("div", "big m"); d.appendChild(el("span", "neg", "−" + fmt(sp.lines.deleted)));
    add(a); add(d);
  } else if (sp.arch) {
    add(el("div", "gap"));
    add(el("div", "big s", sp.arch.title));
    add(el("div", "tag", "“" + sp.arch.tagline + "”"));
    add(el("div", "gap"));
    const b = el("div", "badges");
    sp.arch.traits.forEach(t => b.appendChild(el("span", "badge", t)));
    add(b);
  } else if (sp.poster) {
    add(poster());
  } else {
    if (sp.big != null) {
      add(el("div", "gap"));
      const big = el("div", "big" + (sp.bigClass ? " " + sp.bigClass : ""));
      big.textContent = sp.count ? "0" : sp.big;
      if (sp.count) big.dataset.count = sp.big;
      if (sp.cursor) big.appendChild(el("span", "cursor"));
      add(big);
    }
    if (sp.tag) add(el("div", "tag", sp.tag));
    if (sp.grid) { add(el("div", "gap")); add(calendar()); }
    if (sp.list) add(rankList(sp.list));
    if (sp.note) { add(el("div", "gap")); add(el("div", "note", sp.note)); }
  }

  if (sp.intro && !S.empty) s.appendChild(el("div", "hint", "tape →"));
  return s;
}

function calendar() {
  const wrap = el("div", "cal");
  const C = S.contributions || { weeks: [], max: 0 };
  const max = C.max || 1, LV = ["#161b22","#0e4429","#006d32","#26a641","#39d353"];
  C.weeks.forEach(week => {
    const col = el("div", "wk");
    week.forEach(cell => {
      const c = el("i", "cell");
      if (cell) { const lv = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count/max)*4));
        c.style.background = LV[lv]; } else c.style.visibility = "hidden";
      col.appendChild(c);
    });
    wrap.appendChild(col);
  });
  return wrap;
}
function rankList(items) {
  const box = el("div", "list");
  items.slice(0, 5).forEach((it, i) => {
    const li = el("div", "li");
    li.appendChild(el("span", "rk", (i + 1) + "."));
    li.appendChild(el("span", "nm", it.nm));
    li.appendChild(el("span", "ct", fmt(it.ct)));
    box.appendChild(li);
  });
  return box;
}
function poster() {
  const p = el("div", "poster");
  p.appendChild(el("div", "pe", "Git Wrapped"));
  p.appendChild(el("div", "py", String(S.year)));
  p.appendChild(el("div", null, "Ton année en code"));
  [["Commits", fmt(S.total_commits)],
   ["Lignes", "+"+fmt(S.volume.added)+" / −"+fmt(S.volume.deleted)],
   ["Série max", S.volume.longest_streak+" j"],
   ["Top projet", S.projects.top_repos[0].name],
   ["Langage", S.projects.languages[0].ext],
   ["Profil", S.archetype && S.archetype.title ? S.archetype.title : "—"]]
  .forEach(([k, v]) => { const r = el("div", "pstat");
    r.appendChild(el("span", null, k)); r.appendChild(el("span", "pn", v)); p.appendChild(r); });
  return p;
}

// ---- navigation ----
const slides = [...deck.children];
const bars = document.getElementById("bars");
slides.forEach(() => bars.appendChild(el("i")));
const barEls = [...bars.children];
let idx = 0;
function show(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  idx = i;
  slides.forEach((s, j) => s.classList.toggle("active", j === i));
  barEls.forEach((b, j) => b.classList.toggle("done", j <= i));
  bars.classList.toggle("dark", slides[i].dataset.dark === "1");
  const big = slides[i].querySelector(".big[data-count]");
  if (big) countUp(big);
}
phone.addEventListener("click", e => {
  if (e.target.closest("button, a")) return;
  const r = phone.getBoundingClientRect();
  show(idx + ((e.clientX - r.left) < r.width * 0.32 ? -1 : 1));
});
addEventListener("keydown", e => {
  if (e.key === "ArrowRight" || e.key === " ") { show(idx + 1); e.preventDefault(); }
  else if (e.key === "ArrowLeft") show(idx - 1);
});
let sx = null;
phone.addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
phone.addEventListener("touchend", e => {
  if (sx == null) return;
  const dx = e.changedTouches[0].clientX - sx;
  if (dx < -42) show(idx + 1); else if (dx > 42) show(idx - 1);
  sx = null;
});
show(0);

function countUp(node) {
  if (node.dataset.done) return;
  node.dataset.done = "1";
  const to = +node.dataset.count;
  if (reduce || to <= 0) { node.textContent = fmt(to); return; }
  const dur = 1000, t0 = performance.now();
  (function step(t) { const p = Math.min(1, (t - t0) / dur);
    node.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step); })(t0);
}

// ---- partage : slide/carte -> PNG ----
function esc(t) { return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function wrap(t, max) { const ws = String(t).split(" "); const out = []; let cur = "";
  ws.forEach(w => { if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur.trim()); cur = w; }
    else cur += " " + w; }); if (cur.trim()) out.push(cur.trim()); return out; }
function cardSVG(sp) {
  const [bg, fg, acc] = PAL[sp.bg];
  const W = 1080, H = 1920, PX = 96;
  let body = "", y = 300;
  const T = (s, size, fill, weight, mono) =>
    `<text x="${PX}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight||700}" font-family="${mono?"ui-monospace, Menlo, monospace":"Helvetica, Arial, sans-serif"}">${esc(s)}</text>`;
  if (sp.eyebrow) { body += `<text x="${PX}" y="180" fill="${fg}" font-size="34" font-weight="800" letter-spacing="6" font-family="ui-monospace, Menlo, monospace" opacity="0.85">${esc("› "+sp.eyebrow.toUpperCase())}</text>`; }

  if (sp.lines) {
    y = 640; body += `<text x="${PX}" y="${y}" fill="${sp.bg==="violet"||sp.bg==="cobalt"||sp.bg==="ink"?"#C6FF3D":acc}" font-size="180" font-weight="700" font-family="ui-monospace, Menlo, monospace">+${esc(fmt(sp.lines.added))}</text>`;
    y += 220; body += `<text x="${PX}" y="${y}" fill="${sp.bg==="coral"?fg:"#FF5A36"}" font-size="180" font-weight="700" font-family="ui-monospace, Menlo, monospace">-${esc(fmt(sp.lines.deleted))}</text>`;
  } else if (sp.arch) {
    y = 560; wrap(sp.arch.title, 12).forEach(l => { body += T(l, 130, fg, 700, true); y += 150; });
    y += 30; wrap("“"+sp.arch.tagline+"”", 30).forEach(l => { body += T(l, 44, fg, 700); y += 62; });
    y += 30; let bx = PX; sp.arch.traits.forEach(tr => { const wdt = 40 + esc(tr).length * 26;
      body += `<rect x="${bx}" y="${y-46}" width="${wdt}" height="70" rx="35" fill="none" stroke="${fg}" stroke-width="2"/>`;
      body += `<text x="${bx+wdt/2}" y="${y}" fill="${fg}" font-size="34" font-weight="700" text-anchor="middle" font-family="ui-monospace, Menlo, monospace">${esc(tr)}</text>`;
      bx += wdt + 24; });
  } else {
    if (sp.big != null) { y = 560; const big = String(sp.big);
      const fs = big.length <= 5 ? 300 : big.length <= 10 ? 180 : 110;
      body += T(big, fs, fg, 700, true); y += fs * 0.5 + 90; }
    if (sp.tag) { wrap(sp.tag, 18).forEach(l => { body += T(l, 66, fg, 800); y += 82; }); }
    if (sp.grid) { y += 30; const C = S.contributions || { weeks: [], max: 0 };
      const max = C.max || 1, LV = ["#161b22","#0e4429","#006d32","#26a641","#39d353"];
      const cs = 15, gp = 3, gx = PX, gy = y;
      C.weeks.forEach((wk, wi) => wk.forEach((cell, di) => { if (!cell) return;
        const lv = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count/max)*4));
        body += `<rect x="${gx+wi*(cs+gp)}" y="${gy+di*(cs+gp)}" width="${cs}" height="${cs}" rx="3" fill="${LV[lv]}"/>`; }));
      y = gy + 7 * (cs + gp) + 60; }
    if (sp.list) { sp.list.slice(0,5).forEach((it, i) => {
      body += `<text x="${PX}" y="${y}" fill="${fg}" font-size="46" font-weight="700" font-family="ui-monospace, Menlo, monospace">${esc((i+1)+".  "+it.nm)}</text>`;
      body += `<text x="${W-PX}" y="${y}" fill="${fg}" font-size="46" font-weight="700" text-anchor="end" opacity="0.7" font-family="ui-monospace, Menlo, monospace">${esc(fmt(it.ct))}</text>`;
      y += 78; }); }
    if (sp.note) { y += 20; wrap(sp.note, 34).forEach(l => { body += T(l, 40, fg, 600); y += 56; }); }
  }
  const foot = `<text x="${PX}" y="1832" fill="${fg}" opacity="0.55" font-size="28" letter-spacing="3" font-family="ui-monospace, Menlo, monospace">${esc("git-wrapped · "+S.year)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${bg}"/>` + body + foot + `</svg>`;
}
function posterSVG() {
  const W = 1080, H = 1920, PX = 96;
  const rows = [["Commits", fmt(S.total_commits)],
    ["Lignes", "+"+fmt(S.volume.added)+"  /  -"+fmt(S.volume.deleted)],
    ["Serie max", S.volume.longest_streak+" j"],
    ["Top projet", S.projects.top_repos[0].name],
    ["Langage", S.projects.languages[0].ext],
    ["Profil", S.archetype && S.archetype.title ? S.archetype.title : "-"]];
  let y = 620, body = "";
  rows.forEach(([k, v]) => {
    body += `<text x="${PX}" y="${y}" fill="#F4F4F0" font-size="42" font-weight="700" font-family="Helvetica, Arial, sans-serif">${esc(k)}</text>`;
    body += `<text x="${W-PX}" y="${y}" fill="#C6FF3D" font-size="42" font-weight="700" text-anchor="end" font-family="ui-monospace, Menlo, monospace">${esc(v)}</text>`;
    body += `<line x1="${PX}" y1="${y+30}" x2="${W-PX}" y2="${y+30}" stroke="#23232a" stroke-width="2"/>`;
    y += 138;
  });
  const C = S.contributions || { weeks: [], max: 0 };
  const max = C.max || 1, LV = ["#161b22","#0e4429","#006d32","#26a641","#39d353"];
  const cs = 15, gp = 3, gy = 1560; let grid = "";
  C.weeks.forEach((wk, wi) => wk.forEach((cell, di) => { if (!cell) return;
    const lv = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count/max)*4));
    grid += `<rect x="${PX+wi*(cs+gp)}" y="${gy+di*(cs+gp)}" width="${cs}" height="${cs}" rx="3" fill="${LV[lv]}"/>`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="#0B0B0F"/>`
    + `<text x="${PX}" y="210" fill="#C6FF3D" font-size="36" font-weight="800" letter-spacing="10" font-family="Helvetica, Arial, sans-serif">GIT WRAPPED</text>`
    + `<text x="${PX-4}" y="400" fill="#F4F4F0" font-size="200" font-weight="700" font-family="ui-monospace, Menlo, monospace">${S.year}</text>`
    + `<text x="${PX}" y="478" fill="#8b949e" font-size="38" font-weight="600" font-family="Helvetica, Arial, sans-serif">Ton annee en code</text>`
    + body + grid
    + `<text x="${PX}" y="1840" fill="#6b6b73" font-size="26" letter-spacing="4" font-family="ui-monospace, Menlo, monospace">genere par git-wrapped</text>`
    + `</svg>`;
}
function sharePNG(svg, name) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  img.onload = () => {
    try {
      const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
      cv.getContext("2d").drawImage(img, 0, 0);
      cv.toBlob(b => save(URL.createObjectURL(b), "git-wrapped-" + S.year + "-" + name + ".png"), "image/png");
    } catch (e) { save(url, "git-wrapped-" + S.year + "-" + name + ".svg"); return; }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => save(url, "git-wrapped-" + S.year + "-" + name + ".svg");
  img.src = url;
}
function save(href, n) { const a = el("a"); a.href = href; a.download = n;
  document.body.appendChild(a); a.click(); a.remove(); }
</script>
</body>
</html>
"""


def render(stats: dict, output_path: Path) -> None:
    """Écrit une page HTML autonome à `output_path` à partir de `stats`."""
    data = json.dumps(stats, ensure_ascii=False).replace("<", "\\u003c")
    html = (_TEMPLATE
            .replace("__FONTS__", _font_faces())
            .replace("__YEAR__", str(stats["year"]))
            .replace("__DATA__", data))
    output_path.write_text(html, encoding="utf-8")
