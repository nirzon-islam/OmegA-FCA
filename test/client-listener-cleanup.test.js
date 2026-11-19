"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("../src/api/client");

const appState = [
  { key: "c_user", value: "123456", domain: "facebook.com" },
  { key: "xs", value: "synthetic-session-value", domain: "facebook.com" }
];

test("failed MQTT listener attachment does not leak an error callback", async () => {
  let transportCallback;
  const client = createClient({
    requireLicense: false,
    reconnect: { maxAttempts: 1, minDelayMs: 0, maxDelayMs: 0, jitter: 0 },
    authenticate: async () => ({
      getCurrentUserID: () => "123456",
      listen(callback) {
        transportCallback = callback;
        return () => {};
      },
      disconnect: async () => {}
    })
  });

  const api = await client.login({ mode: "appstate", appState });
  const stopListener = api.listen(() => {});
  let mqttErrorCalls = 0;
  assert.throws(() => api.listenMqtt(() => { mqttErrorCalls++; }), /already attached/);

  transportCallback(new Error("synthetic listener failure"));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mqttErrorCalls, 0);

  stopListener();
  await client.logout();
});
