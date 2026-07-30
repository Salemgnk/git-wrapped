// Serveur autonome zéro-dépendance (module http natif) pour héberger Git Wrapped
// n'importe où — pas besoin de Vercel. Sert web/ + route /api/* vers les mêmes
// handlers, et relance le recalcul du classement périodiquement (cron intégré).
//
//   GITHUB_TOKEN=ghp_... node server.js
//   PORT=8080 node server.js --no-cron
//
// KV : Vercel KV / Upstash si KV_REST_API_URL est défini, sinon fichier local .data/.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refresh } from "./api/cron/refresh.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ROOT, "web");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

// Routes API -> module handler (import paresseux, mis en cache par le loader ESM).
const API = {
  "/api/wrapped": () => import("./api/wrapped.js"),
  "/api/leaderboard": () => import("./api/leaderboard.js"),
  "/api/refresh": () => import("./api/refresh.js"),
  "/api/auth/start": () => import("./api/auth/start.js"),
  "/api/auth/callback": () => import("./api/auth/callback.js"),
  "/api/leave": () => import("./api/leave.js"),
  "/api/me": () => import("./api/me.js"),
  "/api/me/wrapped": () => import("./api/me/wrapped.js"),
  "/api/app/installed": () => import("./api/app/installed.js"),
  "/api/cron/refresh": () => import("./api/cron/refresh.js"),
};

// Adapte (req,res) Node vers la forme "Vercel-ish" attendue par les handlers.
function adapt(req, res, searchParams) {
  const vreq = { method: req.method, headers: req.headers,
    query: Object.fromEntries(searchParams) };
  const vres = {
    setHeader: (k, v) => res.setHeader(k, v),
    status(code) { res.statusCode = code; return this; },
    json(obj) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); return this; },
    end(x) { res.end(x); return this; },
  };
  return { vreq, vres };
}

function serveStatic(pathname, res) {
  let rel = pathname === "/" ? "index.html"
    : pathname === "/classement" ? "classement.html"
    : pathname.replace(/^\/+/, "");
  const file = path.join(WEB, rel);
  if (!file.startsWith(WEB)) { res.statusCode = 403; res.end("forbidden"); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; res.setHeader("Content-Type", "text/plain"); res.end("not found"); return; }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}

async function handleRequest(req, res) {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname.startsWith("/api/")) {
    const loader = API[u.pathname];
    if (!loader) { res.statusCode = 404; res.end("not found"); return; }
    const { vreq, vres } = adapt(req, res, u.searchParams);
    try { await (await loader()).default(vreq, vres); }
    catch (e) { res.statusCode = 500; res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "server error" })); }
    return;
  }
  serveStatic(u.pathname, res);
}

export function createServer() { return http.createServer(handleRequest); }

export function startCron(intervalHours) {
  const run = () => refresh()
    .then((r) => console.log("[cron]", JSON.stringify(r)))
    .catch((e) => console.error("[cron] échec:", e.message));
  setTimeout(run, 4000);
  return setInterval(run, intervalHours * 3600 * 1000);
}

export function start() {
  const port = process.env.PORT || 3000;
  const server = createServer();
  server.listen(port, () => console.log(`Git Wrapped self-host → http://localhost:${port}`));
  if (!process.argv.includes("--no-cron")) startCron(+(process.env.REFRESH_HOURS || 6));
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) start();
