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

test("parses username credentials from account.txt", () => {
  const parsed = parseAccountText("# owner config\nFB_USERNAME=owner_handle\nFB_PASSWORD='secret-value'\nFB_2FA_CODE=123456");
  assert.equal(parsed.fb_username, "owner_handle");
  assert.equal(parsed.fb_password, "secret-value");
  assert.equal(parsed.fb_2fa_code, "123456");
});

test("loads root account.txt credentials and lets environment override file", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "account.txt"), "fb_email=owner@example.test\nfb_password=file-secret");
  const config = loadAccountConfig({ cwd: root, env: { FB_PASSWORD: "env-secret" } });
  assert.equal(config.mode, "credentials");
  assert.equal(config.email, "owner@example.test");
  assert.equal(config.password, "env-secret");
}));

test("loads AppState from root appstate.json when credentials are absent", () => withRoot(root => {
  const state = [{ key: "c_user", value: "12345", domain: "facebook.com" }, { key: "xs", value: "synthetic", domain: "facebook.com" }];
  fs.writeFileSync(path.join(root, "appstate.json"), JSON.stringify(state));
  const config = loadAccountConfig({ cwd: root, env: {} });
  assert.equal(config.mode, "appstate");
  assert.deepEqual(config.appState, state);
}));

test("rejects incomplete credentials and paths outside project root", () => withRoot(root => {
  fs.writeFileSync(path.join(root, "account.txt"), "fb_username=owner");
  assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /FB_PASSWORD/);
  assert.throws(() => loadAccountConfig({ cwd: root, accountFile: "../outside.txt", env: {} }), /inside the project root/);
}));

test("rejects account and AppState symlinks that escape the project root", () => withRoot(root => {
  const outside = path.join(os.tmpdir(), "omega-fca-outside-" + process.pid + ".txt");
  fs.writeFileSync(outside, "fb_username=owner\nfb_password=secret");
  try {
    fs.symlinkSync(outside, path.join(root, "account.txt"));
    assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /resolve inside the project root/);
  } finally {
    fs.rmSync(outside, { force: true });
  }
}));

test("rejects AppState symlinks that escape the project root", () => withRoot(root => {
  const outside = path.join(os.tmpdir(), "omega-fca-appstate-outside-" + process.pid + ".json");
  fs.writeFileSync(outside, JSON.stringify([
    { key: "c_user", value: "12345", domain: "facebook.com" },
    { key: "xs", value: "synthetic", domain: "facebook.com" }
  ]));
  try {
    fs.symlinkSync(outside, path.join(root, "appstate.json"));
    assert.throws(() => loadAccountConfig({ cwd: root, env: {} }), /resolve inside the project root/);
  } finally {
    fs.rmSync(outside, { force: true });
  }
}));

test("rejects unsupported and duplicate account.txt keys", () => {
  assert.throws(() => parseAccountText("password=bad"), /Unsupported account.txt key/);
  assert.throws(() => parseAccountText("fb_email=a\nfb_email=b"), /Duplicate account.txt key/);
});
