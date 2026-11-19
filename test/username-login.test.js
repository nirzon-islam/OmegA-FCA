"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("../src/api/client");
const appState = [
  { key: "c_user", value: "123456", domain: "facebook.com" },
  { key: "xs", value: "synthetic-session-value", domain: "facebook.com" }
];

test("client accepts FB_USERNAME credentials and passes username to its auth provider", async () => {
  let received;
  const client = createClient({
    authenticate: async context => {
      received = context;
      return { listen: () => () => {}, disconnect: async () => {} };
    }
  });
  await client.login({ mode: "credentials", username: "owner_handle", password: "synthetic-password" });
  assert.equal(received.mode, "credentials");
  assert.deepEqual(received.credentials, {
    username: "owner_handle",
    password: "synthetic-password",
    twoFactorSecret: null,
    twoFactorCode: null,
    userAgent: null,
    proxy: null
  });
  await client.logout();
});

test("client keeps email login backward compatible", async () => {
  let received;
  const client = createClient({
    authenticate: async context => {
      received = context.credentials;
      return { listen: () => () => {}, disconnect: async () => {} };
    }
  });
  await client.login({ mode: "credentials", email: "owner@example.test", password: "synthetic-password" });
  assert.equal(received.email, "owner@example.test");
  assert.equal(received.username, undefined);
  await client.logout();
});

test("client rejects credentials without FB_USERNAME/email and password", async () => {
  const client = createClient({ authenticate: async () => ({}) });
  await assert.rejects(
    client.login({ mode: "credentials", password: "synthetic-password" }),
    /Username \(FB_USERNAME\) or email, and password/
  );
});
