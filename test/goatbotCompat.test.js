"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createGoatBotLogin } = require("../src/compat/goatbotLogin");

test("adapts GoatBot AppState login signature to the client contract", async () => {
  let received;
  const client = {
    async login(credentials, options) {
      received = { credentials, options };
      return { getCurrentUserID: () => "123456", listenMqtt: () => {} };
    }
  };
  const login = createGoatBotLogin(client);
  let callbackResult;
  const api = await login(
    { appState: [{ key: "c_user", value: "123456" }] },
    { userAgent: "synthetic-agent" },
    (error, value) => { callbackResult = { error, value }; }
  );
  assert.equal(received.credentials.mode, "appstate");
  assert.equal(received.options.userAgent, "synthetic-agent");
  assert.equal(callbackResult.error, null);
  assert.equal(callbackResult.value, api);
});

test("adapts GoatBot credential login and manual 2FA data", async () => {
  let received;
  const login = createGoatBotLogin({
    async login(credentials) { received = credentials; return { ok: true }; }
  });
  await login({ email: "demo@example.com", pass: "synthetic-password", "2FASecret": "synthetic-2fa" }, {}, () => {});
  assert.equal(received.mode, "credentials");
  assert.equal(received.password, "synthetic-password");
  assert.equal(received.twoFactorSecret, "synthetic-2fa");
});
