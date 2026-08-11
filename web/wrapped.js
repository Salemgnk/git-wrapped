function renderWrapped(mount, S, onExit) {
  mount.innerHTML = '<div class="stage" id="stage">'
    + '<div class="chrome"><div class="sysbar">'
    + '<button class="homebtn" id="homebtn"><span class="dot">\u2190</span> git-wrapped</button>'
    + '<span id="counter">01 / 01</span></div><div class="prog" id="prog"></div></div>'
    + '<div class="deck" id="deck"></div></div>';
const deck = mount.querySelector("#deck");
const ACCENTS = ["#D6FF3D","#FF5CA8","#4DE1FF","#FF7A3C","#9B7CFF","#4CE6A0"];
const DAYS = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const PARTIAL = S.year === new Date().getFullYear();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = n => (n == null ? "0" : n.toLocaleString("fr-FR"));

function el(t, c, x) { const e = document.createElement(t);
  if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function card(ai) { const c = el("div", "card");
  c.style.setProperty("--acc", ACCENTS[ai % ACCENTS.length]); return c; }

// ---- visuels animés du haut de carte ----
function pulseBar() {
  const v = el("div", "viz"), p = el("div", "pulse"), N = 32;
  for (let i = 0; i < N; i++) {
    const b = el("i");
    b.style.animationDelay = (-(Math.sin(i / N * Math.PI * 3) + 1) * 0.9).toFixed(2) + "s";
    p.appendChild(b);
  }
  v.appendChild(p); return v;
}
function barChart(values) {
  const max = Math.max(1, ...values);
  const v = el("div", "viz"), ch = el("div", "chart");
  values.forEach(val => { const b = el("i");
    b.dataset.h = Math.max(4, Math.round(val / max * 100)); ch.appendChild(b); });
  v.appendChild(ch); return v;
}
function streakMeter(streak) {
  const total = Math.max(30, Math.ceil(streak / 5) * 5);
  const v = el("div", "viz"), row = el("div", "streakm");
  for (let i = 0; i < total; i++) row.appendChild(el("i", i < streak ? "on" : null));
  v.appendChild(row); return v;
}
function diffBar(added, deleted) {
  const v = el("div", "viz"), bar = el("div", "diffbar");
  const g = el("div", "g"); g.dataset.w = Math.round(added / (added + deleted) * 100);
  bar.appendChild(g); bar.appendChild(el("div", "r"));
  v.appendChild(bar); return v;
}
function commitsPerMonth() {
  const m = new Array(12).fill(0);
  (S.contributions.weeks || []).forEach(w => w.forEach(c => {
    if (c) m[+c.date.slice(5, 7) - 1] += c.count; }));
  return m;
}
function perHour() {
  const h = new Array(24).fill(0);
  (S.rhythm.heatmap || []).forEach(row => row.forEach((val, hr) => h[hr] += val));
  return h;
}
function svgViz(svg) { const v = el("div", "viz"); v.innerHTML = svg; return v; }
const ICON_COMMIT =
  '<svg viewBox="0 0 24 44" fill="none" stroke="currentColor" stroke-width="2.6">'
  + '<line x1="12" y1="4" x2="12" y2="40"/>'
  + '<circle cx="12" cy="7" r="4.2" fill="#0C0C0E"/>'
  + '<circle cx="12" cy="22" r="4.2" fill="currentColor" stroke="none"/>'
  + '<circle cx="12" cy="37" r="4.2" fill="#0C0C0E"/></svg>';
const ICON_FLAME =
  '<svg viewBox="0 0 32 32" fill="currentColor">'
  + '<path d="M19 2c1.2 5.2-1.6 7.4-3.8 9.6C13 13.8 11 16 11 19.5a9 9 0 0018 0c0-2.8-1.2-5-2.8-6.7'
  + '.3 2-1.2 3.3-2.7 3.3C25.5 11.5 22.5 6.2 19 2z"/>'
  + '<path d="M16.5 17c-2 1.5-3.2 3.1-3.2 5.2a4.7 4.7 0 009.4 0c0-1.5-.7-2.8-1.8-3.8'
  + '.2 1.4-.9 2.4-2 2.4.4-1.7-.5-3-2.4-3.8z" fill="#0C0C0E"/></svg>';

// ---- partage de la carte récap (image PNG -> partage natif / téléchargement) ----
function esc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fontFaceCSS() {
  let css = "";
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) if (r.type === 5) css += r.cssText; } catch (e) {}
  }
  return css;
}
function svgT(x, y, fill, size, weight, content, mono, ls, anchor) {
  const fam = mono ? "'Mono',ui-monospace,Menlo,monospace"
    : "'Grotesk',Helvetica,Arial,sans-serif";
  return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" font-size="' + size
    + '" font-weight="' + weight + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "")
    + (ls ? ' letter-spacing="' + ls + '"' : "") + ' font-family="' + fam + '">'
    + esc(content) + '</text>';
}
function recapSVG(fontCSS) {
  const W = 1080, H = 1920, acc = "#FF7A3C", ink = "#F4F3EE", dim = "#8b8b85",
    line = "#2A2A31", panel = "#17140f", bg = "#0C0C0E", PX = 108;
  let s = '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>';
  // calendrier (cellules orange)
  const C = S.contributions || { weeks: [], max: 0 }, max = C.max || 1;
  const LV = ["#211d18", "#5a3016", "#8f4a17", "#d9741f", "#FF7A3C"], gy = 150;
  const pitch = calPitch(C.weeks.length, W - 2 * PX, 15), gp = pitch * 0.14, cs = pitch - gp;
  C.weeks.forEach((w, wi) => w.forEach((c, di) => { if (!c) return;
    const lv = c.count === 0 ? 0 : Math.min(4, Math.ceil(c.count / max * 4));
    s += '<rect x="' + (PX + wi * (cs + gp)) + '" y="' + (gy + di * (cs + gp)) + '" width="' + cs + '" height="' + cs + '" rx="1" fill="' + LV[lv] + '"/>'; }));
  s += svgT(PX, 360, acc, 34, "800", "// LE RECAP", true, 6);
  // ticket : ombre dure + panneau bordé
  const sr = splitRecap();
  const rows = [
    ["commits", fmt(S.total_commits)],
    ...(sr ? [["pub / priv", sr]] : []),
    ["lignes", "+" + kfmt(S.volume.added) + " / -" + kfmt(S.volume.deleted)],
    ["serie max", S.volume.longest_streak + " j"],
    ["top projet", S.projects.top_repos[0].name],
    ["langage", langStats()[0].nm],
    ["profil", S.archetype && S.archetype.title ? S.archetype.title : "-"]];
  const pTop = 440, pPad = 56, rowH = 128, pw = W - 2 * PX;
  const pH = pPad * 2 + 96 + rows.length * rowH;
  s += '<rect x="' + (PX + 16) + '" y="' + (pTop + 16) + '" width="' + pw + '" height="' + pH + '" fill="' + acc + '"/>';
  s += '<rect x="' + PX + '" y="' + pTop + '" width="' + pw + '" height="' + pH + '" fill="' + panel + '" stroke="' + ink + '" stroke-width="3"/>';
  let y = pTop + pPad + 40;
  s += svgT(PX + pPad, y, acc, 34, "800",
    S.user ? ("@" + S.user).toUpperCase() : "GIT WRAPPED", true, 6);
  s += svgT(PX + pw - pPad, y, acc, 34, "800", String(S.year), true, 4, "end");
  s += '<line x1="' + (PX + pPad) + '" y1="' + (y + 34) + '" x2="' + (PX + pw - pPad) + '" y2="' + (y + 34) + '" stroke="' + line + '" stroke-width="2"/>';
  y += 92;
  rows.forEach(([k, v]) => {
    s += svgT(PX + pPad, y, dim, 30, "700", k.toUpperCase(), true, 3);
    s += svgT(PX + pw - pPad, y, ink, 42, "700", v, false, 0, "end");
    y += rowH;
  });
  s += svgT(PX, pTop + pH + 116, acc, 50, "800",
    (PARTIAL ? "WRAP " + S.year + " · JUSQU'ICI" : "C'EST TON WRAP " + S.year), true, 4);
  s += svgT(PX, 1858, "#6b6b73", 26, "500", "genere par git-wrapped", true, 4);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<defs><style>' + (fontCSS || fontFaceCSS()) + '</style></defs>' + s + '</svg>';
}
// Polices pour l'export : inline les woff2 en base64 (sinon url() relatif -> fallback
// dans le PNG rasterisé). Sur la CLI, fontFaceCSS() contient déjà du base64.
let _fontCache = null;
async function exportFontCSS() {
  if (_fontCache != null) return _fontCache;
  let css = fontFaceCSS();
  if (!/url\(/.test(css) || /url\(\s*['"]?data:/.test(css)) { _fontCache = css; return css; }
  const uniq = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)]
    .map(m => m[1].trim().replace(/^['"]|['"]$/g, "")))];
  const map = {};
  await Promise.all(uniq.map(async u => {
    try {
      const buf = await (await fetch(u)).arrayBuffer(), bytes = new Uint8Array(buf);
      let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      map[u] = "data:font/woff2;base64," + btoa(bin);
    } catch (e) { map[u] = u; }
  }));
  css = css.replace(/url\(([^)]+)\)/g, (m, p) =>
    "url(" + (map[p.trim().replace(/^['"]|['"]$/g, "")] || p) + ")");
  _fontCache = css; return css;
}
function svgShare(svg, name, done) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  const fin = () => { if (done) done(); };
  img.onload = () => {
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
    cv.getContext("2d").drawImage(img, 0, 0);
    cv.toBlob(async blob => {
      URL.revokeObjectURL(url);
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Git Wrapped " + S.year,
          text: "Mon année en code 🖥️" }); fin(); return; }
        catch (e) { if (e.name === "AbortError") { fin(); return; } }
      }
      const a = el("a"); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); fin();
    }, "image/png");
  };
  img.onerror = () => { const a = el("a"); a.href = url;
    a.download = name.replace(/\.png$/, ".svg"); document.body.appendChild(a); a.click(); a.remove(); fin(); };
  img.src = url;
}
function shareRecap() { showExporting(true);
  exportFontCSS().then(fc => svgShare(recapSVG(fc), "git-wrapped-" + S.year + ".png",
    () => showExporting(false))); }

// ---- export fidèle d'une carte : SVG natif reconstruit depuis S (clone 1:1) ----
function wrapTxt(t, max) { const ws = String(t).split(" "), out = []; let cur = "";
  for (const w of ws) { if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur.trim()); cur = w; }
    else cur += " " + w; } if (cur.trim()) out.push(cur.trim()); return out; }
const _mc = document.createElement("canvas"), _mx = _mc.getContext("2d");
function measureW(t, px, mono, weight) {
  _mx.font = (weight || 700) + " " + px + "px " + (mono ? "'Mono',monospace" : "'Grotesk',sans-serif");
  return _mx.measureText(t).width;
}
const INK = "#F4F3EE", DIM = "#8b8b85", PANEL = "#141417", HLINE = "#2A2A31";
function svgBlock(x, y, w, h, acc) {
  return '<rect x="' + (x + 18) + '" y="' + (y + 18) + '" width="' + w + '" height="' + h + '" fill="' + acc + '"/>'
    + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + PANEL + '" stroke="' + INK + '" stroke-width="6"/>';
}
// chaque item = { h, draw(x, yTop) -> chaîne svg }
function iEyebrow(t, acc) { return { h: 54, draw: (x, y) =>
  svgT(x, y + 40, acc, 40, "800", t.toUpperCase(), true, 5) }; }
function iBlockNum(t, acc, size) {
  const bw = measureW(t, size, false, 700) + 80, bh = size * 0.72 + 68;
  return { h: bh, draw: (x, y) => svgBlock(x, y, bw, bh, acc)
    + svgT(x + 40, y + bh * 0.5 + size * 0.26, INK, size, 700, t, false, 0) };
}
function iUnit(t, acc) { return { h: 78, draw: (x, y) =>
  svgT(x, y + 54, acc, 58, "800", t.toUpperCase(), true, 3) }; }
function iJoke(t, acc) { const lines = wrapTxt(t, 34);
  return { h: lines.length * 56 + 8, draw: (x, y) => {
    let s = svgT(x, y + 42, acc, 44, "800", "#", true, 0);
    lines.forEach((ln, k) => s += svgT(x + (k === 0 ? 44 : 0), y + 42 + k * 56, "#DAD9D2", 42, "500", ln, true, 0));
    return s; } }; }
function iNote(t) { const lines = wrapTxt(t, 40);
  return { h: lines.length * 52, draw: (x, y) => lines.map((ln, k) =>
    svgT(x, y + 40 + k * 52, DIM, 40, "500", ln, true, 0)).join("") }; }
function iTitle(t) { const lines = wrapTxt(t, 15);
  return { h: lines.length * 108, draw: (x, y) => lines.map((ln, k) =>
    svgT(x, y + 78 + k * 108, INK, 96, "700", ln, false, 0)).join("") }; }
function iChip(t) { const w = measureW(t.toUpperCase(), 36, true, 700) + 56;
  return { h: 74, draw: (x, y) =>
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="56" fill="none" stroke="' + HLINE + '" stroke-width="2"/>'
    + svgT(x + 28, y + 40, INK, 36, "700", t.toUpperCase(), true, 4) }; }
function iCal(acc) {
  const C = S.contributions || { weeks: [], max: 0 }, max = C.max || 1;
  const pitch = calPitch(C.weeks.length, 888, 15), gp = pitch * 0.2, cs = pitch - gp;
  return { h: 7 * (cs + gp) + 20, draw: (x, y) => { let s = "";
    C.weeks.forEach((w, wi) => w.forEach((c, di) => { if (!c) return;
      const bx = x + wi * (cs + gp), by = y + di * (cs + gp);
      s += '<rect x="' + bx + '" y="' + by + '" width="' + cs + '" height="' + cs + '" rx="1" fill="rgba(244,243,238,.06)"/>';
      const lv = c.count === 0 ? 0 : Math.min(4, Math.ceil(c.count / max * 4));
      if (lv > 0) s += '<rect x="' + bx + '" y="' + by + '" width="' + cs + '" height="' + cs + '" rx="1" fill="' + acc + '" fill-opacity="' + [0, .3, .55, .78, 1][lv] + '"/>'; }));
    return s; } }; }
function iRecord(count, date, acc) {
  return { h: 150, draw: (x, y) =>
    '<rect x="' + x + '" y="' + y + '" width="10" height="140" fill="' + acc + '"/>'
    + svgT(x + 44, y + 34, DIM, 32, "700", "RECORD DU JOUR", true, 5)
    + svgT(x + 44, y + 108, acc, 64, "700", fmt(count), false, 0)
    + svgT(x + 44 + measureW(fmt(count), 64, false, 700) + 22, y + 108, INK, 52, "700",
        "commits · le " + frDate(date), false, 0) }; }
function iRank(items, acc, CW) {
  const rows = items.slice(0, 5);
  let hh = 0; rows.forEach((_, k) => hh += k === 0 ? 88 : 68);
  return { h: hh, draw: (x, y) => { let s = "", cy = y;
    rows.forEach((it, k) => { const top = k === 0, sz = top ? 62 : 46;
      s += svgT(x, cy + sz * 0.8, top ? acc : DIM, sz, "700", String(k + 1).padStart(2, "0"), true, 0);
      s += svgT(x + 90, cy + sz * 0.8, top ? acc : INK, sz, "700", it.nm, true, 0);
      s += svgT(x + CW, cy + sz * 0.8, DIM, sz * 0.8, "700", fmt(it.ct), true, 0, "end");
      cy += top ? 88 : 68; });
    return s; } }; }
function iDiff(add, del) { return { h: 400, draw: (x, y) =>
  svgT(x, y + 150, "#56D364", 176, "700", "+" + fmt(add), false, 0)
  + svgT(x, y + 350, "#F0616D", 176, "700", "−" + fmt(del), false, 0) }; }
function iName(t, acc) { const lines = wrapTxt(t, 13);
  return { h: lines.length * 128, draw: (x, y) => lines.map((ln, k) =>
    svgT(x, y + 100 + k * 128, acc, 122, "700", ln, false, 0)).join("") }; }
function iVtag(t) { const lines = wrapTxt("« " + t + " »", 24);
  return { h: lines.length * 74 + 10, draw: (x, y) => lines.map((ln, k) =>
    svgT(x, y + 56 + k * 74, INK, 60, "500", ln, false, 0)).join("") }; }
function iBadges(traits, acc, CW) {
  const chips = traits.map(t => ({ t, w: measureW(t, 36, true, 700) + 44 }));
  const gap = 20, rows = [[]]; let rw = 0;
  chips.forEach(c => { if (rw + c.w > CW && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
    rows[rows.length - 1].push(c); rw += c.w + gap; });
  return { h: rows.length * 74, draw: (x, y) => { let s = "";
    rows.forEach((row, ri) => { let cx = x;
      row.forEach(c => { s += '<rect x="' + cx + '" y="' + (y + ri * 74) + '" width="' + c.w + '" height="56" fill="none" stroke="' + acc + '" stroke-width="3"/>'
        + svgT(cx + 22, y + ri * 74 + 40, acc, 36, "700", c.t, true, 2); cx += c.w + gap; }); });
    return s; } }; }
function stackBottom(items, x, bottom) {
  const gap = 46, total = items.reduce((a, i) => a + i.h, 0) + gap * (items.length - 1);
  let y = bottom - total, s = "";
  items.forEach(it => { s += it.draw(x, y); y += it.h + gap; });
  return s;
}
function stackTop(items, x, top) {
  const gap = 40; let y = top, s = "";
  items.forEach(it => { s += it.draw(x, y); y += it.h + gap; });
  return s;
}
function frameSVG(body, acc, i, fontCSS) {
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">'
    + '<defs>'
    + '<radialGradient id="g1" cx="82%" cy="4%" r="72%"><stop offset="0" stop-color="' + acc + '" stop-opacity=".22"/><stop offset=".6" stop-color="' + acc + '" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="g2" cx="6%" cy="100%" r="62%"><stop offset="0" stop-color="' + acc + '" stop-opacity=".09"/><stop offset=".55" stop-color="' + acc + '" stop-opacity="0"/></radialGradient>'
    + '<style>' + (fontCSS || fontFaceCSS()) + '</style></defs>'
    + '<rect width="1080" height="1920" fill="#0C0C0E"/>'
    + '<rect width="1080" height="1920" fill="url(#g1)"/>'
    + '<rect width="1080" height="1920" fill="url(#g2)"/>';
  s += svgT(96, 92, DIM, 30, "700", "● git-wrapped", true, 4);
  s += svgT(984, 92, DIM, 30, "700", pad(i + 1) + " / " + pad(slides.length), true, 4, "end");
  const n = slides.length, g = 10, pw = (888 - g * (n - 1)) / n;
  for (let k = 0; k < n; k++) { const bx = 96 + k * (pw + g);
    s += '<rect x="' + bx + '" y="120" width="' + pw + '" height="10" fill="none" stroke="' + HLINE + '" stroke-width="2"/>';
    if (k <= i) s += '<rect x="' + bx + '" y="120" width="' + pw + '" height="10" fill="' + acc + '"/>'; }
  s += body;
  s += svgT(96, 1866, "#6b6b73", 26, "500", "genere par git-wrapped", true, 4);
  return s + '</svg>';
}
function cardSVG(i, fontCSS) {
  if (i === 9) return recapSVG(fontCSS);
  const acc = ACCENTS[i % ACCENTS.length], PX = 96, CW = 888;
  let items = [], top = false;
  if (i === 0) {
    items = [iEyebrow("// ton année en code", acc), iBlockNum(String(S.year), acc, 236),
      iTitle(PARTIAL ? "Tes commits, jusqu'ici." : "Récap de tes commits.")];
    items.push(S.empty ? iNote("silence radio — aucun commit en " + S.year + ".")
      : iChip("▸ appuie pour démarrer"));
  } else if (i === 1) {
    items = [iEyebrow("// cette année, tu as poussé", acc), iBlockNum(fmt(S.total_commits), acc, 236),
      iUnit("commits", acc), iJoke(commitJoke(S.total_commits), acc),
      iNote("sur " + fmt(S.volume.active_days) + " jours actifs, dans " + fmt(S.projects.repo_count) + " dépôts.")];
    const sn = splitNote();
    if (sn) items.push(iNote(sn));
  } else if (i === 2) {
    items = [iEyebrow("// ton rythme", acc),
      iTitle("Tu codes surtout à " + S.rhythm.peak_hour + "h, le " + DAYS[S.rhythm.peak_weekday] + "."),
      iCal(acc), iJoke(rhythmJoke(S.rhythm.peak_hour), acc),
      iNote(S.rhythm.night_owl_pct + "% de tes commits tombent entre 22h et 5h.")];
  } else if (i === 3) {
    items = [iEyebrow("// ta plus longue série", acc), iBlockNum(fmt(S.volume.longest_streak), acc, 236),
      iUnit("jours d'affilée", acc), iJoke(streakJoke(S.volume.longest_streak), acc),
      iRecord(S.volume.busiest_day.count, S.volume.busiest_day.date, acc)];
  } else if (i === 4) {
    items = [iEyebrow("// le bilan des dégâts", acc), iDiff(S.volume.added, S.volume.deleted),
      iUnit("lignes écrites / effacées", acc), iJoke(linesJoke(S.volume.added, S.volume.deleted), acc)];
  } else if (i === 5) {
    top = true;
    items = [iEyebrow("// ton obsession", acc),
      iRank(S.projects.top_repos.map(r => ({ nm: r.name, ct: r.count })), acc, CW),
      iJoke(projectJoke(S.projects.top_repos[0].count, S.total_commits), acc)];
  } else if (i === 6) {
    top = true; const langs = langStats();
    items = [iEyebrow("// ta stack de l'année", acc), iRank(langs, acc, CW), iJoke(langJoke(langs[0].nm), acc)];
  } else if (i === 7) {
    const w0 = S.words.top_words[0];
    let sz = 220; while (measureW(w0.word, sz, false, 700) > CW - 120 && sz > 90) sz -= 10;
    items = [iEyebrow("// ton mot fétiche", acc), iBlockNum(w0.word, acc, sz),
      iUnit("écrit " + fmt(w0.count) + " fois", acc)];
    const others = S.words.top_words.slice(1, 5).map(w => w.word);
    if (others.length) items.push(iNote("aussi : " + others.join(" · ")));
    items.push(iJoke(wordJoke(w0.word), acc));
  } else if (i === 8) {
    top = true;
    items = [iEyebrow("// verdict", acc), iName(S.archetype.title, acc), iVtag(S.archetype.tagline),
      iBadges(S.archetype.traits, acc, CW)];
  }
  const body = top ? stackTop(items, PX, 360) : stackBottom(items, PX, 1700);
  return frameSVG(body, acc, i, fontCSS);
}
function exportCard() {
  showExporting(true);
  exportFontCSS().then(fc => svgShare(cardSVG(idx, fc),
    "git-wrapped-" + S.year + "-" + pad(idx + 1) + ".png", () => showExporting(false)));
}
function showExporting(on) {
  let ov = document.getElementById("expov");
  if (!ov) { ov = el("div", "expov"); ov.id = "expov";
    ov.innerHTML = '<div class="expbars"></div><div class="expmsg">génération de la fiche…</div>';
    for (let i = 0; i < 16; i++) { const b = el("i");
      b.style.animationDelay = (-i * 0.06).toFixed(2) + "s"; ov.querySelector(".expbars").appendChild(b); }
    stage.appendChild(ov); }
  ov.classList.toggle("on", on);
}

// ---- CARTE 01 : INTRO ----
function slideIntro() {
  const c = card(0);
  c.appendChild(pulseBar());
  c.appendChild(el("div", "eyebrow", "// ton année en code"));
  const block = el("div", "block");
  const y = el("div", "year"); y.textContent = S.year;
  y.appendChild(el("span", "cursor"));
  block.appendChild(y);
  c.appendChild(block);
  const t = el("div", "title");
  if (PARTIAL) {
    t.appendChild(document.createTextNode("Tes "));
    t.appendChild(el("em", null, "commits"));
    t.appendChild(document.createTextNode(", jusqu'ici."));
  } else {
    t.appendChild(document.createTextNode("Récap de tes "));
    t.appendChild(el("em", null, "commits"));
    t.appendChild(document.createTextNode("."));
  }
  c.appendChild(t);
  if (S.empty) {
    c.appendChild(el("div", "joke", "silence radio — aucun commit en " + S.year + "."));
    return c;
  }
  const chip = el("div", "chip");
  chip.appendChild(el("span", "k", "▸ "));
  chip.appendChild(document.createTextNode("appuie pour démarrer"));
  c.appendChild(chip);
  c.appendChild(el("div", "hint", "→"));
  return c;
}

// ---- CARTE 02 : COMMITS ----
function slideCommits() {
  const c = card(1);
  c.appendChild(svgViz(ICON_COMMIT));
  c.appendChild(el("div", "eyebrow", "// cette année, tu as poussé"));
  const block = el("div", "block");
  const n = el("div", "num"); n.dataset.count = S.total_commits;
  n.textContent = reduce ? fmt(S.total_commits) : "0";
  block.appendChild(n);
  c.appendChild(block);
  c.appendChild(el("div", "unit", "commits"));
  c.appendChild(el("div", "joke", commitJoke(S.total_commits)));
  c.appendChild(el("div", "note",
    "sur " + fmt(S.volume.active_days) + " jours actifs, dans " +
    fmt(S.projects.repo_count) + " dépôts."));
  const sn = splitNote();
  if (sn) c.appendChild(el("div", "note", sn));
  return c;
}
// Répartition public / privé. Ne s'affiche que sur le wrapped perso : un wrapped
// public n'embarque aucun commit privé, donc rien à révéler.
function splitNote() {
  const sp = S.commits_split;
  if (!sp || !sp.private) return null;
  return "dont " + fmt(sp.public) + " sur des repos publics et "
    + fmt(sp.private) + " en privé.";
}
// Ligne du ticket récap : libellé et valeur courts, le ticket n'a qu'une ligne.
function splitRecap() {
  const sp = S.commits_split;
  return sp && sp.private ? fmt(sp.public) + " / " + fmt(sp.private) : null;
}
function commitJoke(n) {
  if (n < 50) return "T'as surtout poussé des excuses cette année.";
  if (n < 200) return "Le minimum syndical, pile respecté.";
  if (n < 500) return "Honnête. Personne ne t'érige de statue non plus.";
  if (n < 1000) return "Ça bosse. Ta vie sociale a fermé le repo.";
  if (n < 2000) return "git blame, c'est toujours toi. Assume.";
  if (n < 3500) return "Va dehors. L'IRL mérite un commit aussi.";
  return "Ce n'est plus un métier, c'est un symptôme.";
}

// ---- CARTE 03 : RYTHME + GRAPHE DE CONTRIBUTIONS ----
function slideRhythm() {
  const c = card(2);
  c.appendChild(barChart(perHour()));
  c.appendChild(el("div", "eyebrow", "// ton rythme"));
  const t = el("div", "title");
  t.appendChild(document.createTextNode("Tu codes surtout à "));
  t.appendChild(el("em", null, S.rhythm.peak_hour + "h"));
  t.appendChild(document.createTextNode(", le "));
  t.appendChild(el("em", null, DAYS[S.rhythm.peak_weekday]));
  t.appendChild(document.createTextNode("."));
  c.appendChild(t);
  c.appendChild(calendar());
  c.appendChild(el("div", "joke", rhythmJoke(S.rhythm.peak_hour)));
  c.appendChild(el("div", "note",
    S.rhythm.night_owl_pct + "% de tes commits tombent entre 22h et 5h."));
  return c;
}
function rhythmJoke(h) {
  if (h >= 21 || h <= 1) return "Le soleil, tu l'as croisé en capture d'écran.";
  if (h <= 5) return "3h du mat. Tes commits et tes regrets, même horaire.";
  if (h <= 10) return "Lève-tôt. Tes commits sentent encore le café.";
  if (h <= 14) return "Tu codes entre deux bouchées. Le pain a des miettes de bug.";
  return "Productif l'après-midi. Un vrai adulte, presque.";
}
// Pas horizontal d'une case, pour que N semaines tiennent dans la largeur dispo.
// Au-delà d'un an (~53 colonnes) les cases rétrécissent au lieu de déborder.
function calPitch(weeks, avail, maxPitch) {
  return Math.min(maxPitch, avail / Math.max(1, weeks));
}
function calendar() {
  const wrap = el("div", "cal");
  const C = S.contributions || { weeks: [], max: 0 };
  const max = C.max || 1;
  const PCT = [0, 26, 50, 74, 100];
  const pitch = calPitch(C.weeks.length, 88, 1.66);   // 88cqw = largeur de carte moins marges
  wrap.style.setProperty("--cgap", (pitch * 0.19).toFixed(3) + "cqw");
  wrap.style.setProperty("--cell", (pitch * 0.81).toFixed(3) + "cqw");
  C.weeks.forEach(week => {
    const col = el("div", "wk");
    week.forEach(cell => {
      const i = el("i", "cell");
      if (cell) {
        const lv = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count / max) * 4));
        if (lv > 0)
          i.style.background = "color-mix(in srgb, var(--acc) " + PCT[lv] + "%, #141417)";
      } else i.style.visibility = "hidden";
      col.appendChild(i);
    });
    wrap.appendChild(col);
  });
  return wrap;
}

// ---- CARTE 04 : SÉRIE (JOURS D'AFFILÉE) ----
function slideStreak() {
  const c = card(3);
  c.appendChild(svgViz(ICON_FLAME));
  c.appendChild(el("div", "eyebrow", "// ta plus longue série"));
  const block = el("div", "block");
  const n = el("div", "num"); n.dataset.count = S.volume.longest_streak;
  n.textContent = reduce ? fmt(S.volume.longest_streak) : "0";
  block.appendChild(n);
  c.appendChild(block);
  c.appendChild(el("div", "unit", "jours d'affilée"));
  c.appendChild(el("div", "joke", streakJoke(S.volume.longest_streak)));
  const b = S.volume.busiest_day;
  const rec = el("div", "record");
  rec.appendChild(el("div", "lab", "record du jour"));
  const val = el("div", "val");
  val.appendChild(el("b", null, fmt(b.count)));
  val.appendChild(document.createTextNode(" commits · le " + frDate(b.date)));
  rec.appendChild(val);
  c.appendChild(rec);
  return c;
}
function streakJoke(n) {
  if (n <= 1) return "Une série de 1 jour. Techniquement, ça compte.";
  if (n <= 3) return "Trois jours, puis la vie a repris le dessus.";
  if (n <= 6) return "Presque une semaine. Presque.";
  if (n <= 13) return "Belle série. Ton canapé s'en souvient.";
  if (n <= 29) return "Deux semaines non-stop. Le burnout a fait coucou ?";
  return "Un mois d'affilée. Touche. De. L'herbe.";
}
function frDate(iso) { return iso.slice(8, 10) + "/" + iso.slice(5, 7); }

// ---- CARTE 05 : LIGNES +/− ----
function slideLines() {
  const c = card(4);
  c.appendChild(diffBar(S.volume.added, S.volume.deleted));
  c.appendChild(el("div", "eyebrow", "// le bilan des dégâts"));
  const box = el("div", "diffs");
  const add = el("div", "diff add");
  add.dataset.count = S.volume.added; add.dataset.prefix = "+";
  add.textContent = reduce ? "+" + fmt(S.volume.added) : "+0";
  const del = el("div", "diff del");
  del.dataset.count = S.volume.deleted; del.dataset.prefix = "−";
  del.textContent = reduce ? "−" + fmt(S.volume.deleted) : "−0";
  box.appendChild(add); box.appendChild(del);
  c.appendChild(box);
  c.appendChild(el("div", "unit", "lignes écrites / effacées"));
  c.appendChild(el("div", "joke", linesJoke(S.volume.added, S.volume.deleted)));
  return c;
}
function linesJoke(a, d) {
  if (d > a * 1.3) return "Tu supprimes plus que tu n'écris. Marie Kondo du code.";
  if (a > d * 1.3) return "Tu empiles les lignes. Le repo a pris du bide.";
  return "Ajouté, supprimé : équilibre parfait. Ou indécision totale.";
}

// ---- CARTE 06 : TOP PROJET ----
function slideTopProject() {
  const c = card(5); c.classList.add("quiz");
  c.appendChild(el("div", "icon", "★"));
  c.appendChild(el("div", "eyebrow", "// devine · ton obsession"));
  const correct = S.projects.top_repos[0].name;
  const reveal = el("div");
  reveal.appendChild(rankList(S.projects.top_repos.map(r => ({ nm: r.name, ct: r.count }))));
  reveal.appendChild(el("div", "joke",
    projectJoke(S.projects.top_repos[0].count, S.total_commits)));
  quiz(c, "Ton dépôt le plus actif, c'est… ?", correct, repoOptions(correct), reveal, true);
  return c;
}
function rankList(items) {
  const box = el("div", "rank");
  items.slice(0, 5).forEach((it, idx) => {
    const r = el("div", "r" + (idx === 0 ? " top" : ""));
    r.appendChild(el("span", "i", String(idx + 1).padStart(2, "0")));
    r.appendChild(el("span", "n", it.nm));
    r.appendChild(el("span", "c", fmt(it.ct)));
    box.appendChild(r);
  });
  return box;
}
function projectJoke(topCount, total) {
  return topCount / total > 0.4
    ? "Monogame du dépôt. Les autres repos jalousent."
    : "Touche-à-tout. Ton attention part en 404.";
}

// ---- CARTE 07 : TOP LANGAGE (révélation directe) ----
function slideTopLang() {
  const c = card(6); c.classList.add("top");
  const langs = langStats();
  c.appendChild(el("div", "icon", "</>"));
  c.appendChild(el("div", "eyebrow", "// ta stack de l'année"));
  c.appendChild(rankList(langs));
  c.appendChild(el("div", "joke", langJoke(langs[0].nm)));
  return c;
}
const LANG_NAMES = {
  ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript",
  ".ts": "TypeScript", ".tsx": "TypeScript", ".py": "Python", ".rs": "Rust", ".go": "Go",
  ".java": "Java", ".kt": "Kotlin", ".rb": "Ruby", ".php": "PHP", ".c": "C", ".h": "C",
  ".cpp": "C++", ".cc": "C++", ".hpp": "C++", ".cs": "C#", ".swift": "Swift",
  ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".sass": "SCSS", ".vue": "Vue",
  ".svelte": "Svelte", ".md": "Markdown", ".sh": "Shell", ".bash": "Shell", ".sql": "SQL",
  ".json": "JSON", ".yml": "YAML", ".yaml": "YAML", ".toml": "TOML", ".dart": "Dart",
  ".lua": "Lua", ".ex": "Elixir", ".r": "R", ".vim": "Vimscript",
};
const LANG_SKIP = new Set([".map", ".lock", ".snap", ".min", ".txt", ".log", ".csv"]);
function langStats() {
  const agg = {};
  (S.projects.languages || []).forEach(l => {
    if (LANG_SKIP.has(l.ext)) return;
    const nm = LANG_NAMES[l.ext] || l.ext.replace(".", "").toUpperCase() || "?";
    agg[nm] = (agg[nm] || 0) + l.count;
  });
  return Object.entries(agg).map(([nm, ct]) => ({ nm, ct }))
    .sort((a, b) => b.ct - a.ct).slice(0, 6);
}

// composant quizz réutilisable : question -> options -> révélation
function quiz(c, question, correct, options, reveal, wide) {
  const qq = el("div", "qq", question);
  c.appendChild(qq);
  const optsBox = el("div", "opts" + (wide ? " wide" : ""));
  options.forEach(opt => {
    const b = el("button", "opt", opt);
    b.addEventListener("click", e => {
      e.stopPropagation();
      if (optsBox.dataset.done) return;
      optsBox.dataset.done = "1";
      [...optsBox.children].forEach(x => { x.disabled = true;
        if (x.textContent === correct) x.classList.add("correct");
        else if (x === b) x.classList.add("wrong"); });
      qq.textContent = opt === correct ? "Bien vu." : "Raté — c'était " + correct + ".";
      setTimeout(() => { optsBox.style.display = "none"; reveal.style.display = "";
        c.dataset.quizDone = "1"; resume(); }, reduce ? 0 : 750);
    });
    optsBox.appendChild(b);
  });
  c.appendChild(optsBox);
  reveal.style.display = "none";
  c.appendChild(reveal);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function repoOptions(correct) {
  const opts = S.projects.top_repos.map(r => r.name).slice(0, 4);
  if (!opts.includes(correct)) opts[0] = correct;
  for (const p of ["portfolio","dotfiles","api","website","scripts","playground","app","config"]) {
    if (opts.length >= 4) break;
    if (!opts.includes(p)) opts.push(p);
  }
  return shuffle(opts);
}
function wordOptions(correct) {
  const decoys = S.words.top_words.slice(1).map(w => w.word);
  ["feat","fix","add","update","refactor","wip","docs","test","chore","merge"]
    .forEach(p => { if (p !== correct && !decoys.includes(p)) decoys.push(p); });
  return shuffle([correct, ...shuffle(decoys).slice(0, 3)]);
}
function langJoke(name) {
  const M = {
    JavaScript: "JavaScript. Tu aimes souffrir, on dirait.",
    TypeScript: "TypeScript. Le JS qui a fait une thérapie.",
    Python: "Python. import bonheur — sans point-virgule.",
    Rust: "Rust. Le compilateur te déteste, pour ton bien.",
    Go: "Go. if err != nil, encore et encore.",
    Java: "Java. AbstractSingletonFactoryBean te salue.",
    PHP: "PHP. On ne juge pas. (On juge un peu.)",
    Ruby: "Ruby. Encore vivant, et fier.",
    C: "C. Segfault as a lifestyle.",
    "C++": "C++. 40 ans et ça compile toujours pas.",
    "C#": "C#. Java, mais avec Microsoft dans le dos.",
    HTML: "Du HTML. « C'est pas du code » — eux, jamais toi.",
    CSS: "Du CSS. Centrer une div reste ton Everest.",
    SCSS: "Du SCSS. Du CSS qui se la raconte.",
    Markdown: "Surtout de la doc. Rare, précieux, suspect.",
    Shell: "Du shell. rm -rf en confiance aveugle.",
    SQL: "SQL. SELECT * FROM regrets;",
    Vue: "Vue. React pour les gens équilibrés.",
    Swift: "Swift. Tu codes, Xcode plante. Duo iconique.",
  };
  return M[name] || name + " à toutes les sauces. Signature reconnaissable.";
}

// ---- CARTE 08 : MOT FÉTICHE ----
function slideWord() {
  const c = card(7); c.classList.add("quiz");
  c.appendChild(el("div", "icon", "#"));
  c.appendChild(el("div", "eyebrow", "// devine · ton mot fétiche"));
  const w0 = S.words.top_words[0];
  const reveal = el("div");
  reveal.appendChild(el("div", "unit", "écrit " + fmt(w0.count) + " fois"));
  const others = S.words.top_words.slice(1, 5).map(w => w.word);
  if (others.length) reveal.appendChild(el("div", "note", "aussi : " + others.join(" · ")));
  reveal.appendChild(el("div", "joke", wordJoke(w0.word)));
  quiz(c, "Ton mot de commit n°1, c'est… ?", w0.word, wordOptions(w0.word), reveal, false);
  return c;
}
function wordJoke(w) {
  const M = {
    feat: "feat, feat, feat. Bâtisseur·euse de features assumé·e.",
    fix: "Ton mot, c'est « fix ». Tout va bien, vraiment ?",
    wip: "« wip » partout. Fini un jour, promis ?",
    update: "« update ». L'art de ne rien dire en un mot.",
    refactor: "« refactor ». Jamais content, jamais fini.",
    merge: "« merge ». Tu passes ta vie à réconcilier des branches.",
    add: "« add ». Concis. Peut-être trop.",
    remove: "Tu commits surtout pour supprimer. Poète du vide.",
    delete: "Tu commits surtout pour supprimer. Poète du vide.",
    test: "« test ». Un·e héros·ïne discret·e.",
    docs: "« docs ». On t'aime — personne d'autre ne le fait.",
    chore: "« chore ». Le ménage, encore et toujours.",
    init: "« init ». Beaucoup de débuts. Et les fins ?",
    style: "« style ». Le fond attendra.",
  };
  return M[w] || "« " + w + " » à toutes les sauces. Signature reconnaissable.";
}

// ---- CARTE 09 : ARCHÉTYPE / PERSONNALITÉ ----
function slideArchetype() {
  const c = card(8); c.classList.add("top");
  c.appendChild(el("div", "icon", "❖"));
  c.appendChild(el("div", "eyebrow", "// verdict"));
  c.appendChild(el("div", "name", S.archetype.title));
  c.appendChild(el("div", "vtag", "« " + S.archetype.tagline + " »"));
  const b = el("div", "badges");
  S.archetype.traits.forEach(t => b.appendChild(el("span", "badge", t)));
  c.appendChild(b);
  return c;
}

// ---- CARTE 10 : RÉCAP ----
function kfmt(n) { return n >= 1000 ? Math.round(n / 1000) + "k" : String(n); }
function slideRecap() {
  const c = card(9);
  c.appendChild(el("div", "eyebrow", "// le récap"));
  const sr = splitRecap();
  const r = el("div", sr ? "receipt dense" : "receipt");
  const h = el("div", "rh");
  h.appendChild(el("span", null, S.user ? "@" + S.user : "git wrapped"));
  h.appendChild(el("span", null, String(S.year)));
  r.appendChild(h);
  [["commits", fmt(S.total_commits)],
   ...(sr ? [["pub / priv", sr]] : []),
   ["lignes", "+" + kfmt(S.volume.added) + " / −" + kfmt(S.volume.deleted)],
   ["série max", S.volume.longest_streak + " j"],
   ["top projet", S.projects.top_repos[0].name],
   ["langage", langStats()[0].nm],
   ["profil", S.archetype.title]]
  .forEach(([k, val]) => { const row = el("div", "row");
    row.appendChild(el("span", "k", k)); row.appendChild(el("span", "v", val));
    r.appendChild(row); });
  c.appendChild(r);
  c.appendChild(el("div", "unit",
    PARTIAL ? "ton wrap " + S.year + " · jusqu'ici" : "c'est ton wrap " + S.year));
  const btn = el("button", "dl", "Partager ma carte");
  btn.addEventListener("click", e => { e.stopPropagation(); shareRecap(); });
  c.appendChild(btn);
  const star = el("a", "star", "★ ça t'a plu ? mets une étoile ↗");
  star.href = "https://github.com/Salemgnk/git-wrapped";
  star.target = "_blank"; star.rel = "noopener";
  star.addEventListener("click", e => e.stopPropagation());
  c.appendChild(star);
  return c;
}

// La liste des cartes grandit au fur et à mesure qu'on les designe.
const BUILDERS = S.empty ? [slideIntro]
  : [slideIntro, slideCommits, slideRhythm, slideStreak, slideLines,
     slideTopProject, slideTopLang, slideWord, slideArchetype, slideRecap];

const slides = BUILDERS.map(b => { const c = b(); deck.appendChild(c); return c; });
const prog = mount.querySelector("#prog");
const counter = mount.querySelector("#counter");
slides.forEach(() => { const i = el("i"); i.appendChild(el("b")); prog.appendChild(i); });
const dots = [...prog.children];
const pad = n => String(n).padStart(2, "0");
const DURATION = 5000;
let idx = 0, playing = true, timer = null;

function isWaiting() {
  const c = slides[idx];
  return c.classList.contains("quiz") && !c.dataset.quizDone;
}
function show(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  idx = i;
  slides.forEach((s, j) => s.classList.toggle("active", j === i));
  counter.textContent = pad(i + 1) + " / " + pad(slides.length);
  slides[i].querySelectorAll("[data-count]").forEach(countUp);
  slides[i].querySelectorAll("[data-h]").forEach(b => b.style.height = b.dataset.h + "%");
  slides[i].querySelectorAll("[data-w]").forEach(b => b.style.width = b.dataset.w + "%");
  dots.forEach((d, j) => { const b = d.firstChild;
    b.style.transition = "none"; b.style.width = j < i ? "100%" : "0%"; });
  startTimer();
}
function startTimer() {
  clearTimeout(timer);
  if (!playing || isWaiting()) return;
  const b = dots[idx].firstChild;
  requestAnimationFrame(() => {
    b.style.transition = "width " + DURATION + "ms linear"; b.style.width = "100%"; });
  timer = setTimeout(() => {
    if (idx < slides.length - 1) show(idx + 1); else setPlaying(false);
  }, DURATION);
}
function resume() { if (playing) startTimer(); }
function setPlaying(p) {
  playing = p; playBtn.textContent = playing ? "❚❚" : "▶";
  if (playing) startTimer();
  else { clearTimeout(timer); const b = dots[idx].firstChild;
    const w = getComputedStyle(b).width; b.style.transition = "none"; b.style.width = w; }
}
function countUp(node) {
  if (node.dataset.done) return;
  node.dataset.done = "1";
  const to = +node.dataset.count, pre = node.dataset.prefix || "";
  if (reduce || to <= 0) { node.textContent = pre + fmt(to); return; }
  const dur = 1100, t0 = performance.now();
  (function step(t) { const p = Math.min(1, (t - t0) / dur);
    node.textContent = pre + fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step); })(t0);
}

// ---- contrôles play/pause + musique ----
const stage = mount.querySelector("#stage");
const ctrl = el("div", "ctrl");
const playBtn = el("button", "cbtn", "❚❚");
const muteBtn = el("button", "cbtn", "♪");
const expBtn = el("button", "cbtn", "⤓");
ctrl.appendChild(expBtn); ctrl.appendChild(playBtn); ctrl.appendChild(muteBtn);
stage.appendChild(ctrl);
playBtn.addEventListener("click", e => { e.stopPropagation(); firstGesture(); setPlaying(!playing); });
muteBtn.addEventListener("click", e => { e.stopPropagation(); toggleMute(); });
expBtn.addEventListener("click", e => { e.stopPropagation(); exportCard(); });

let audioCtx, master, musicTimer, track = null, musicOn = true, musicStarted = false;
const TRACK_VOL = 0.45;
// Si un vrai morceau libre de droits est déposé (web/music.mp3), on l'utilise ;
// sinon on retombe sur le chiptune généré (déjà 100% libre de droits). La sonde
// se fait tôt (avant le 1er geste) pour rester déclenchable par le geste.
let hasTrack = false;
fetch("./music.mp3", { method: "HEAD" }).then(r => { if (r.ok) hasTrack = true; }).catch(() => {});
function startMusic() {
  if (musicStarted) return; musicStarted = true;
  if (hasTrack) {
    track = new Audio("./music.mp3"); track.loop = true;
    track.volume = musicOn ? TRACK_VOL : 0;
    track.play().catch(() => startChiptune());
  } else startChiptune();
}
function startChiptune() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  master = audioCtx.createGain(); master.gain.value = musicOn ? 0.06 : 0;
  master.connect(audioCtx.destination);
  const seq = [0, 3, 7, 12, 7, 3, 5, 10], base = 196, beat = 0.22; let n = 0;
  musicTimer = setInterval(() => {
    if (!audioCtx || audioCtx.state !== "running") return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.type = "square";
    o.frequency.value = base * Math.pow(2, seq[n % seq.length] / 12);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.8);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + beat); n++;
  }, beat * 1000);
}
function toggleMute() {
  musicOn = !musicOn;
  muteBtn.classList.toggle("off", !musicOn);
  if (!musicStarted && musicOn) startMusic();
  if (track) track.volume = musicOn ? TRACK_VOL : 0;
  if (master) master.gain.value = musicOn ? 0.06 : 0;
}
function firstGesture() {
  if (musicOn) startMusic();
  if (track && track.paused && musicOn) track.play().catch(() => {});
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

// ---- navigation ----
stage.addEventListener("click", e => {
  if (e.target.closest("button")) return;
  firstGesture();
  const r = stage.getBoundingClientRect();
  show(idx + ((e.clientX - r.left) < r.width * 0.32 ? -1 : 1));
});
function keyHandler(e) {
  if (e.key === "ArrowRight" || e.key === " ") { firstGesture(); show(idx + 1); e.preventDefault(); }
  else if (e.key === "ArrowLeft") { firstGesture(); show(idx - 1); }
}
addEventListener("keydown", keyHandler);
let sx = null;
stage.addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
stage.addEventListener("touchend", e => { if (sx == null) return; firstGesture();
  const dx = e.changedTouches[0].clientX - sx;
  if (dx < -42) show(idx + 1); else if (dx > 42) show(idx - 1); sx = null; });

// ---- retour accueil : démontage propre (timers, audio, listeners) ----
function destroy() {
  clearTimeout(timer); clearInterval(musicTimer);
  if (track) { try { track.pause(); } catch (e) {} track = null; }
  if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
  removeEventListener("keydown", keyHandler);
  mount.innerHTML = "";
}
const homebtn = mount.querySelector("#homebtn");
if (typeof onExit === "function") {
  homebtn.addEventListener("click", e => { e.stopPropagation(); destroy(); onExit(); });
} else {
  homebtn.querySelector(".dot").textContent = "●";   // pas de retour en sortie CLI autonome
  homebtn.style.cursor = "default"; homebtn.style.pointerEvents = "none";
}
show(0);
}
window.renderWrapped = renderWrapped;
