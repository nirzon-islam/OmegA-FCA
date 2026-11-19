"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createLegacyFcaProvider } = require("../src/compat/legacyFcaTransport");
const { createClient } = require("../src/api/client");

function fakeApi() {
  let callback;
  let stopped = 0;
  return {
    api: {
      getCurrentUserID: () => "123456789",
      listenMqtt(fn) { callback = fn; return () => { stopped++; }; },
      stopListening() { stopped++; },
      sendMessage: async value => ({ messageID: value }),
      getThreadInfo: async id => ({ threadID: id }),
      sessionGuard() { return "guard"; }
    },
    emit(event) { callback(null, event); },
    stopped() { return stopped; }
  };
}

test("legacy FCA provider maps AppState and exposes personal account methods/events", async () => {
  const fixture = fakeApi();
  let received;
  const provider = createLegacyFcaProvider({
    login(input, options, callback) {
      received = { input, options };
      callback(null, fixture.api);
    },
    options: { forceLogin: true }
  });
  const driver = await provider({
    mode: "appstate",
    credentials: [
      { key: "c_user", value: "123456789", domain: "facebook.com" },
      { key: "xs", value: "synthetic-session", domain: "facebook.com" }
    ],
    options: { userAgent: "test-agent" }
  });
  assert.equal(received.input.appState[0].key, "c_user");
  assert.equal(received.options.forceLogin, true);
  assert.equal(received.options.userAgent, "test-agent");
  assert.equal(driver.getCurrentUserID(), "123456789");
  assert.deepEqual(await driver.sendMessage("hello"), { messageID: "hello" });
  assert.deepEqual(await driver.getThreadInfo("thread-1"), { threadID: "thread-1" });
  assert.equal(driver.sessionGuard(), "guard");
  let receivedEvent;
  const detach = driver.listen((_error, event) => { receivedEvent = event; });
  fixture.emit({ type: "message", body: "hi" });
  assert.equal(receivedEvent.body, "hi");
  detach();
  assert.ok(fixture.stopped() >= 1);
});

test("legacy FCA provider maps credentials and manual 2FA fields", async () => {
  let received;
  const provider = createLegacyFcaProvider({
    login(input, _options, callback) { received = input; callback(null, fakeApi().api); }
  });
  await provider({
    mode: "credentials",
    credentials: {
      email: "owner@example.test",
      password: "synthetic-password",
      twoFactorSecret: "synthetic-secret",
      twoFactorCode: "123456"
    }
  });
  assert.equal(received.email, "owner@example.test");
  assert.equal(received.password, "synthetic-password");
  assert.equal(received.twoFactorSecret, "synthetic-secret");
  assert.equal(received.twoFactorCode, "123456");
});

test("legacy FCA provider rejects timeout and invalid login APIs", async () => {
  const timeoutProvider = createLegacyFcaProvider({
    login() {},
    timeoutMs: 1000
  });
  await assert.rejects(timeoutProvider({
    mode: "appstate",
    credentials: [{ key: "c_user", value: "123456789" }, { key: "xs", value: "x" }]
  }), /timed out/);
  const invalidProvider = createLegacyFcaProvider({
    login(_input, _options, callback) { callback(null, {}); }
  });
  await assert.rejects(invalidProvider({
    mode: "appstate",
    credentials: [{ key: "c_user", value: "123456789" }, { key: "xs", value: "x" }]
  }), /incompatible personal-account API/);
});


test("legacy adapter integrates with createClient and preserves cookie attributes", async () => {
  const fixture = fakeApi();
  let receivedCookies;
  const authenticate = createLegacyFcaProvider({
    login(input, _options, callback) {
      receivedCookies = input.appState;
      callback(null, fixture.api);
    }
  });
  const client = createClient({ authenticate, reconnect: { maxAttempts: 1 } });
  const api = await client.login({ mode: "appstate", appState: [
    { key: "c_user", value: "123456789", domain: "facebook.com", secure: true, httpOnly: true },
    { key: "xs", value: "synthetic-session", domain: "facebook.com", path: "/", sameSite: "None" }
  ] });
  assert.equal(receivedCookies[0].secure, true);
  assert.equal(receivedCookies[0].httpOnly, true);
  assert.equal(receivedCookies[1].sameSite, "None");

  const events = [];
  api.listenMqtt((error, event) => events.push({ error, event }));
  fixture.emit({ type: "message", body: "integration" });
  assert.equal(events.length, 1);
  assert.equal(events[0].error, null);
  assert.equal(events[0].event.body, "integration");
  api.stopListening();
  await client.logout();
});
