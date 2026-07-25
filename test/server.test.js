import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("server: sert la landing, l'API leaderboard (KV fichier) et 404 sur route inconnue", async () => {
  process.env.KV_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gw-srv-"));
  delete process.env.KV_REST_API_URL; // force le fallback fichier local
  const { createServer } = await import("../server.js");
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const base = "http://localhost:" + server.address().port;
  try {
    const lb = await fetch(base + "/api/leaderboard");
    assert.equal(lb.status, 200);
    assert.equal((await lb.json()).empty, true); // pas de snapshot -> empty

    const home = await fetch(base + "/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    assert.match(await home.text(), /git wrapped/i);

    const nope = await fetch(base + "/api/nope");
    assert.equal(nope.status, 404);
  } finally {
    server.close();
    fs.rmSync(process.env.KV_DIR, { recursive: true, force: true });
  }
});
