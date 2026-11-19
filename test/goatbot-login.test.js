"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createGoatBotLogin } = require("../src/compat/goatbotLogin");

test("maps AppState and forwards options", async () => {
  const api = { getCurrentUserID: () => "123456" }; let received; const calls = [];
  const login = createGoatBotLogin({ async login(credentials, options) { received = { credentials, options }; return api; } });
  const result = await login({ appState: [{ key: "c_user", value: "123456" }, { key: "xs", value: "synthetic" }] }, { forceLogin: true }, (error, value) => calls.push({ error, value }));
  assert.equal(result, api); assert.deepEqual(received.options, { forceLogin: true }); assert.equal(received.credentials.mode, "appstate");
  assert.deepEqual(calls, [{ error: null, value: api }]);
});
test("maps fb_email credentials and manual 2FA without persisting secrets", async () => {
  let received; const login = createGoatBotLogin({ async login(credentials) { received = credentials; return {}; } });
  await login({ fb_email: "owner@example.test", password: "pw", twoFactorSecret: "secret", twoFactorCode: "123456" }, () => {});
  assert.deepEqual(received, { mode: "credentials", fb_email: "owner@example.test", password: "pw", twoFactorSecret: "secret", twoFactorCode: "123456", userAgent: null, proxy: null });
});
test("legacy email alias normalizes to fb_email", async () => {
  let received; const login = createGoatBotLogin({ async login(credentials) { received = credentials; return {}; } });
  await login({ email: "owner@example.test", password: "pw" }, () => {}); assert.equal(received.fb_email, "owner@example.test");
});
test("rejects username-only login", async () => {
  const login = createGoatBotLogin({ async login() { return {}; } }); let error;
  assert.equal(await login({ username: "handle", password: "pw" }, e => { error = e; }), null);
  assert.match(error.message, /fb_email\/password/); assert.equal(error.retryable, false);
});
test("loads credentials from config.json only when account.txt is absent", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-config-"));
  try {
    fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { fb_email: "owner@example.test", password: "pw" } }));
    let received; const login = createGoatBotLogin({ async login(credentials) { received = credentials; return {}; } }, { cwd: root, env: {} });
    await login({}, () => {}); assert.equal(received.mode, "credentials"); assert.equal(received.fb_email, "owner@example.test");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("account.txt credential text is rejected and never passed to login", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-account-"));
  try {
    fs.writeFileSync(path.join(root, "account.txt"), "fb_email=owner@example.test\nfb_password=pw");
    const login = createGoatBotLogin({ async login() { throw new Error("must not run"); } }, { cwd: root, env: {} }); let error;
    assert.equal(await login({}, e => { error = e; }), null); assert.ok(error);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
