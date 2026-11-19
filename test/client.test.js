"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("../src/api/client");

test("client accepts AppState mode and exposes a narrow API facade", async () => {
  const client = createClient({
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
  const api = await client.login({ mode: "appstate", appState: [{ key: "c_user", value: "123456", domain: "facebook.com" }] });
  assert.equal(api.getCurrentUserID(), "123456");
  assert.equal(typeof api.sendMessage, "function");
  assert.equal(typeof api.listen, "function");
  await client.logout();
  assert.equal(client.getConnectionState().state, "idle");
});

test("client rejects missing login mode", async () => {
  const client = createClient({ authenticate: async () => ({}) });
  await assert.rejects(client.login({}), /Login mode/);
});
