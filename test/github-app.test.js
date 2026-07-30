import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { appJwt, mintInstallationToken, listInstallationRepos } from "../lib/github-app.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs1", format: "pem" });

test("appJwt encode les claims iss/iat/exp", () => {
  const jwt = appJwt("12345", pem, 1_700_000_000_000);
  const [, body] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.equal(claims.iss, "12345");
  assert.ok(claims.exp > claims.iat);
});

test("mintInstallationToken échange le JWT contre un token", async () => {
  let seenAuth = null, seenUrl = null;
  const fakeFetch = async (url, opts) => {
    seenUrl = url; seenAuth = opts.headers.Authorization;
    return { ok: true, json: async () => ({ token: "ghs_inst", expires_at: "x" }) };
  };
  const tok = await mintInstallationToken("999", { appId: "12345", privateKey: pem, fetchImpl: fakeFetch });
  assert.equal(tok, "ghs_inst");
  assert.ok(seenUrl.endsWith("/app/installations/999/access_tokens"));
  assert.ok(seenAuth.startsWith("Bearer "));
});

test("listInstallationRepos ne garde que les repos privés", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ repositories: [
    { name: "pub", private: false, owner: { login: "alice" } },
    { name: "secret", private: true, owner: { login: "alice" } },
  ] }) });
  const repos = await listInstallationRepos("ghs_inst", { fetchImpl: fakeFetch });
  assert.deepEqual(repos, [{ owner: "alice", name: "secret", isPrivate: true }]);
});
