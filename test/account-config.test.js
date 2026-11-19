"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseAccountText, loadAccountConfig } = require("../src/auth/accountConfig");
function withRoot(run) { const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-account-")); try { run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); } }
const cookie = "c_user=123456789; xs=session-cookie-value";

test("account.txt accepts cookie data only", () => {
  assert.equal(parseAccountText(cookie).find(item => item.key === "c_user").value, "123456789");
  assert.throws(() => parseAccountText("fb_email=a@example.test\nfb_password=secret"));
  assert.throws(() => parseAccountText(JSON.stringify({ fb_email: "a@example.test", password: "secret" })), /cookie array/);
});
test("account.txt AppState takes precedence over config credentials", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "account.txt"), cookie);
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { fb_email: "owner@example.test", password: "secret" } }));
  const config = loadAccountConfig({ cwd: root, env: {} });
  assert.equal(config.mode, "appstate"); assert.equal(config.source, "account.txt"); assert.equal(config.appState.length, 2);
}));
test("loads canonical fb_email/password/TOTP from config.json", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { fb_email: "owner@example.test", password: "pw", "2FASecret": "secret", userAgent: "test-agent" } }));
  const config = loadAccountConfig({ cwd: root, env: {} });
  assert.equal(config.mode, "credentials"); assert.equal(config.fb_email, "owner@example.test"); assert.equal(config.password, "pw");
  assert.equal(config.twoFactorSecret, "secret"); assert.equal(config.userAgent, "test-agent");
}));
test("supports legacy email config alias but ignores FB_USERNAME", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { email: "owner@example.test", password: "pw" } }));
  assert.equal(loadAccountConfig({ cwd: root, env: {} }).fb_email, "owner@example.test");
  assert.throws(() => loadAccountConfig({ cwd: root, env: { FB_USERNAME: "owner", FB_PASSWORD: "pw" } }), /No Facebook session or credentials/);
}));
test("loads FB_EMAIL environment override", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), "{}");
  const config = loadAccountConfig({ cwd: root, env: { FB_EMAIL: "owner@example.test", FB_PASSWORD: "pw", FB_2FA_SECRET: "secret" } });
  assert.equal(config.fb_email, "owner@example.test"); assert.equal(config.password, "pw"); assert.equal(config.twoFactorSecret, "secret");
}));
test("loads AppState JSON fallback", () => withRoot(root => {
  const state = [{ key: "c_user", value: "123456789", domain: "facebook.com" }, { key: "xs", value: "synthetic", domain: "facebook.com" }];
  fs.writeFileSync(path.join(root, "appstate.json"), JSON.stringify(state));
  assert.deepEqual(loadAccountConfig({ cwd: root, env: {} }).appState, state);
}));
test("rejects incomplete credentials and paths outside project root", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ facebookAccount: { fb_email: "owner@example.test" } }));
  assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /requires fb_email and password/);
  assert.throws(() => loadAccountConfig({ cwd: root, accountFile: "../outside.txt", env: {} }), /inside the project root/);
}));
test("rejects account symlinks escaping project root", () => withRoot(root => {
  const outside = path.join(os.tmpdir(), "omega-fca-outside-" + process.pid + ".txt"); fs.writeFileSync(outside, cookie);
  try { fs.symlinkSync(outside, path.join(root, "account.txt")); assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /resolve inside the project root/); }
  finally { fs.rmSync(outside, { force: true }); }
}));
