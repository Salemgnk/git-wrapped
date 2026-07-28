const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const majEl = document.getElementById("maj");
let snap = null, tab = "devs", win = "week";

function segClicks(id, set) {
  document.getElementById(id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    [...e.currentTarget.children].forEach((x) => x.classList.toggle("on", x === b));
    set(b.dataset.v); render();
  });
}
segClicks("tab", (v) => (tab = v));
segClicks("win", (v) => (win = v));

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render() {
  if (!snap || snap.empty || !snap[tab]) {
    listEl.innerHTML = ""; emptyEl.hidden = false;
    emptyEl.textContent = snap && snap.empty ? "Classement en préparation…" : "Personne encore. Sois le premier — clique sur Rejoindre.";
    return;
  }
  emptyEl.hidden = true;
  const rows = snap[tab][win] || [];
  listEl.innerHTML = rows.map((r, i) => {
    const name = tab === "devs"
      ? `<a href="${esc(r.wrappedUrl)}">@${esc(r.login)}</a>`
      : `${esc(r.repo)} <span class="dt">· ${esc(r.owner)}</span>`;
    const av = tab === "devs" && r.avatar ? `<img src="${esc(r.avatar)}" alt="">` : "";
    const d = r.detail;
    // Ventilation exacte du score : lignes ÷ 100, jours × 10, le reste = commits.
    const daysPts = d.joursActifs * 10;
    const linesPts = Math.floor(d.lignes / 100);
    const commitsPts = r.score - daysPts - linesPts;
    return `<li class="row${i < 3 ? " top" : ""}">
      <span class="rk">${String(i + 1).padStart(2, "0")}</span>${av}
      <span class="nm">${name}<div class="dt">${d.commits} commits · ${d.joursActifs} j · ${d.lignes} lignes</div>
      <div class="brk">${commitsPts} <i>commits</i> + ${daysPts} <i>jours</i> + <b>${linesPts} lignes</b></div></span>
      <span class="sc">${r.score}</span></li>`;
  }).join("");
}

function loadBoard() {
  return fetch("/api/leaderboard?t=" + Date.now()).then((r) => r.json()).then((s) => {
    snap = s;
    if (s.updatedAt) {
      const h = Math.round((Date.now() - Date.parse(s.updatedAt)) / 3600000);
      majEl.textContent = "maj il y a " + (h < 1 ? "moins d'1 h" : h + " h");
    }
    render();
  });
}
loadBoard().catch(() => { emptyEl.hidden = false; emptyEl.textContent = "réessaie plus tard."; });

// Bouton « Actualiser » : recalcule le classement (surtout utile juste après
// s'être inscrit) puis recharge. Le serveur temporise si c'est trop rapproché.
const refreshBtn = document.getElementById("refresh");
refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  const label = refreshBtn.textContent;
  refreshBtn.textContent = "Actualisation… (~1 min)";
  try {
    const res = await fetch("/api/refresh", { method: "POST" }).then((r) => r.json());
    await loadBoard();
    if (res.throttled) {
      refreshBtn.textContent = "encore " + res.retryInSec + " s";
    } else {
      refreshBtn.textContent = "✓ à jour";
      refreshBtn.classList.add("done");
    }
  } catch {
    refreshBtn.textContent = "échec, réessaie";
  }
  setTimeout(() => {
    refreshBtn.textContent = label;
    refreshBtn.classList.remove("done");
    refreshBtn.disabled = false;
  }, 2500);
});
