"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("../src/api/client");

test("client accepts a valid AppState and exposes a narrow API facade", async () => {
  const client = createClient({
    requireLicense: false,
    authenticate: async ({ mode, credentials }) => {
      assert.equal(mode, "appstate");
      assert.equal(credentials[0].key, "c_user");
      return {
        getCurrentUserID: () => "123456",
        sendMessage: async () => ({ messageID: "m1" }),
        listen: () => () => {},
        disconnect: async () => {}
      };
    }
  });
  const api = await client.login({ mode: "appstate", appState: [
    { key: "c_user", value: "123456", domain: "facebook.com" },
    { key: "xs", value: "synthetic-session-value", domain: "facebook.com" }
  ] });
  assert.equal(api.getCurrentUserID(), "123456");
  assert.equal(typeof api.sendMessage, "function");
  assert.equal(typeof api.listen, "function");
  await client.logout();
  assert.equal(client.getConnectionState().state, "idle");
});

test("client rejects a session without required auth cookies", async () => {
  const client = createClient({ requireLicense: false, authenticate: async () => ({}) });
  await assert.rejects(client.login({ mode: "appstate", appState: [
    { key: "c_user", value: "123456", domain: "facebook.com" }
  ] }), /c_user and xs/);
});

test("client rejects missing login mode", async () => {
  const client = createClient({ requireLicense: false, authenticate: async () => ({}) });
  await assert.rejects(client.login({}), /Login mode/);
});

test("client requires an owner-signed license by default", async () => {
  const client = createClient({ authenticate: async () => ({}) });
  await assert.rejects(client.login({ mode: "credentials", email: "demo@example.com", password: "not-a-real-password" }), /License token is missing/);
});


test("GoatBot MQTT callback receives (error, event) and can stop listening", async () => {
  let transportCallback;
  let detached = 0;
  const client = createClient({
    requireLicense: false,
    authenticate: async () => ({
      getCurrentUserID: () => "123456",
      listen(callback) {
        transportCallback = callback;
        return () => { detached++; };
      },
      disconnect: async () => {}
    })
  });
  const api = await client.login({ mode: "appstate", appState: [
    { key: "c_user", value: "123456", domain: "facebook.com" },
    { key: "xs", value: "synthetic-session-value", domain: "facebook.com" }
  ] });
  const received = [];
  api.listenMqtt((error, event) => received.push({ error, event }));
  transportCallback(null, { type: "message", messageID: "m1" });
  assert.equal(received[0].error, null);
  assert.equal(received[0].event.messageID, "m1");
  api.stopListening();
  assert.equal(detached, 1);
  await client.logout();
});
