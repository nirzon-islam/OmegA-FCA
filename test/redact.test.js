"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { redactSecrets } = require("../src/security/redact");

test("redacts cookie, app, Page, license, and two-factor secrets across naming styles", () => {
  const input = {
    cookie: "cookie-value",
    appState: [{ key: "c_user", value: "123456" }],
    c_user: "123456",
    pageAccessToken: "page-token",
    appSecret: "app-secret",
    license_key: "license-secret",
    twoFactorSecret: "2fa-secret",
    nested: { authorizationCode: "one-time-code", safe: "visible" }
  };
  const output = redactSecrets(input);
  assert.equal(output.cookie, "[REDACTED]");
  assert.equal(output.appState, "[REDACTED]");
  assert.equal(output.c_user, "[REDACTED]");
  assert.equal(output.pageAccessToken, "[REDACTED]");
  assert.equal(output.appSecret, "[REDACTED]");
  assert.equal(output.license_key, "[REDACTED]");
  assert.equal(output.twoFactorSecret, "[REDACTED]");
  assert.equal(output.nested.authorizationCode, "[REDACTED]");
  assert.equal(output.nested.safe, "visible");
});
