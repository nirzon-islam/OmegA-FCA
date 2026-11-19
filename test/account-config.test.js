"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseAccountText, loadAccountConfig } = require("../src/auth/accountConfig");

function withRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-account-"));
  try { run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const cookie = "c_user=123456789; xs=session-cookie-value";

test("account.txt contains only a raw cookie header", () => {
  const parsed = parseAccountText(cookie);
  assert.equal(parsed.find(item => item.key === "c_user").value, "123456789");
  assert.throws(() => parseAccountText("fb_email=a@example.test\nfb_password=secret"), /Malformed cookie header/);
});

test("loads cookie session from account.txt before config credentials", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "account.txt"), cookie);
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { email: "owner@example.test", password: "secret", "2FASecret": "totp-secret" } }));
  const config = loadAccountConfig({ cwd: root, env: {} });
  assert.equal(config.mode, "appstate");
  assert.equal(config.source, "account.txt");
  assert.equal(config.appState.length, 2);
}));

test("loads email/password/TOTP secret from config.json", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: {
    email: "owner@example.test", password: "password-value", "2FASecret": "totp-secret",
    userAgent: "test-agent", proxy: null
  } }));
  const config = loadAccountConfig({ cwd: root, env: {} });
  assert.equal(config.mode, "credentials");
  assert.equal(config.email, "owner@example.test");
  assert.equal(config.password, "password-value");
  assert.equal(config.twoFactorSecret, "totp-secret");
  assert.equal(config.userAgent, "test-agent");
}));

test("loads username/password through environment overrides", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), "{}");
  const config = loadAccountConfig({ cwd: root, env: { FB_USERNAME: "owner", FB_PASSWORD: "pw", FB_2FA_SECRET: "secret" } });
  assert.equal(config.username, "owner");
  assert.equal(config.password, "pw");
  assert.equal(config.twoFactorSecret, "secret");
}));

test("loads AppState JSON as backward-compatible fallback", () => withRoot(root => {
  const state = [{ key: "c_user", value: "123456789", domain: "facebook.com" }, { key: "xs", value: "session-cookie-value", domain: "facebook.com" }];
  fs.writeFileSync(path.join(root, "appstate.json"), JSON.stringify(state));
  const config = loadAccountConfig({ cwd: root, env: {} });
  assert.equal(config.mode, "appstate");
  assert.deepEqual(config.appState, state);
}));

test("rejects incomplete credentials and paths outside project root", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { email: "owner@example.test" } }));
  assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /requires email/);
  assert.throws(() => loadAccountConfig({ cwd: root, accountFile: "../outside.txt", env: {} }), /inside the project root/);
}));

test("rejects account and config symlinks that escape project root", () => withRoot(root => {
  const outside = path.join(os.tmpdir(), "omega-fca-outside-" + process.pid + ".txt");
  fs.writeFileSync(outside, cookie);
  try {
    fs.symlinkSync(outside, path.join(root, "account.txt"));
    assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /resolve inside the project root/);
  } finally { fs.rmSync(outside, { force: true }); }
});
