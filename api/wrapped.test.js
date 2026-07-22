import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "./wrapped.js";

function res() {
  return { code: 200, body: null, headers: {},
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    json(o) { this.body = o; return this; },
    end(s) { this.body = s; return this; } };
}

test("rejects invalid username (400) before any network", async () => {
  const r = res();
  await handler({ query: { user: "bad name!" } }, r, { token: "t", fetchImpl: () => { throw new Error("no net"); } });
  assert.equal(r.code, 400);
});

test("503 when token missing", async () => {
  const r = res();
  await handler({ query: { user: "octocat" } }, r, { token: "", fetchImpl: () => {} });
  assert.equal(r.code, 503);
});

test("404 when github reports no user", async () => {
  const r = res();
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: { user: null } }) });
  await handler({ query: { user: "ghost" } }, r, { token: "t", fetchImpl: fakeFetch });
  assert.equal(r.code, 404);
});
