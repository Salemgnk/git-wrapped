import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, parseCookies } from "../lib/session.js";

test("sign/verify roundtrip", () => {
  const t = signSession({ login: "alice" }, "secret");
  assert.deepEqual(verifySession(t, "secret"), { login: "alice" });
});

test("verify: rejette signature invalide ou mauvais secret", () => {
  const t = signSession({ login: "alice" }, "secret");
  assert.equal(verifySession(t, "autre"), null);
  assert.equal(verifySession(t.slice(0, -2) + "xx", "secret"), null);
  assert.equal(verifySession("nimportequoi", "secret"), null);
});

test("parseCookies", () => {
  assert.deepEqual(parseCookies("a=1; gw_session=abc.def"), { a: "1", gw_session: "abc.def" });
  assert.deepEqual(parseCookies(""), {});
});
