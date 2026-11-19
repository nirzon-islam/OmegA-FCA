"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("../src/security/cookies");
const { redactSecrets } = require("../src/security/redact");

test("normalizes cookie arrays without mutating the input", () => {
  const input = [{ name: "c_user", value: "123456", domain: ".facebook.com" }];
  const result = normalizeCookies(input);
  assert.equal(result[0].key, "c_user");
  assert.equal(result[0].domain, "facebook.com");
  assert.equal(input[0].key, undefined);
});

test("parses cookie headers while preserving equals signs in values", () => {
  const result = parseCookieHeader("c_user=123456; xs=abc==");
  assert.equal(result[1].value, "abc==");
  assert.equal(validateSessionCookies(result).length, 2);
});

test("parses Netscape cookie rows with tab delimiters", () => {
  const result = parseNetscapeCookies(".facebook.com\tTRUE\t/\tTRUE\t0\tc_user\t123456");
  assert.equal(result[0].key, "c_user");
});

test("rejects non-Facebook cookie domains", () => {
  assert.throws(() => normalizeCookies([{ key: "x", value: "y", domain: "example.com" }]));
});

test("redacts credentials recursively", () => {
  assert.deepEqual(redactSecrets({ user: "ok", cookie: "secret", nested: { password: "secret" } }), {
    user: "ok", cookie: "[REDACTED]", nested: { password: "[REDACTED]" }
  });
});


test("rejects cookie values that can inject additional Cookie header fields", () => {
  for (const value of ["x; admin=true", "x\r\nAuthorization: Bearer token", "value with spaces", "a,b", '"quoted"', "back\\slash"]) {
    assert.throws(() => normalizeCookies([{ key: "xs", value, domain: "facebook.com" }]), /cookie value/);
  }
  assert.equal(parseCookieHeader("c_user=123456; xs=abc==")[1].value, "abc==");
});
