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
    // Détail du score, opérations visibles : commits + jours×10 + lignes÷100.
    return `<li class="row${i < 3 ? " top" : ""}">
      <span class="rk">${String(i + 1).padStart(2, "0")}</span>${av}
      <span class="nm">${name}<div class="dt">${d.commits} commits · ${d.joursActifs} j · ${d.lignes} lignes</div>
      <div class="brk">${d.commits} + ${d.joursActifs}<i>j</i>×10 + ${d.lignes}<i>l</i>÷100 = <b>${r.score}</b></div></span>
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

// Bouton « Actualiser » : recalcule le classement puis recharge. Le libellé du
// bouton ne change PAS (pas de décalage de mise en page) — tout le statut passe
// dans la ligne « maj » en haut à droite. Connecté = recalcul de soi (rapide) ;
// anonyme = recalcul complet (plus long), géré côté serveur.
const refreshBtn = document.getElementById("refresh");
refreshBtn.addEventListener("click", async () => {
  if (refreshBtn.disabled) return;
  refreshBtn.disabled = true;
  refreshBtn.classList.add("loading");
  majEl.textContent = "actualisation en cours…";
  try {
    const res = await fetch("/api/refresh", { method: "POST" }).then((r) => r.json());
    await loadBoard(); // re-render + réécrit majEl avec l'heure
    if (res.throttled) majEl.textContent = "déjà à jour · réessaie dans " + res.retryInSec + " s";
    else majEl.textContent = "✓ classement à jour";
  } catch {
    majEl.textContent = "échec de l'actualisation — réessaie";
  } finally {
    refreshBtn.classList.remove("loading");
    refreshBtn.disabled = false;
  }
});
