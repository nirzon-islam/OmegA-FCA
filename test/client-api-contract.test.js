"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("../src/api/client");

const appState = [
  { key: "c_user", value: "123456", domain: "facebook.com" },
  { key: "xs", value: "synthetic-session-value", domain: "facebook.com" }
];

test("credential login and manual 2FA are deferred in the AppState-only phase", async () => {
  let authenticated = false;
  const client = createClient({
    authenticate: async () => {
      authenticated = true;
      return { listen: () => () => {}, getCurrentUserID: () => "123456", disconnect: async () => {} };
    }
  });
  await assert.rejects(
    client.login({ mode: "credentials", email: "owner@example.test", password: "synthetic-password", twoFactorCode: "123456" }),
    /login is deferred/
  );
  assert.equal(authenticated, false);
});

test("provider authentication errors never expose secret-bearing messages or causes", async () => {
  const client = createClient({
    authenticate: async () => {
      const error = new Error("login failed password=hunter2 cookie=private-session");
      error.cause = new Error("xs=private-cookie");
      throw error;
    },
    reconnect: { maxAttempts: 1 }
  });
  await assert.rejects(client.login({ mode: "appstate", appState }), error => {
    assert.equal(error.code, "FCA_AUTHENTICATION_FAILED");
    assert.match(error.message, /inspect provider diagnostics securely/);
    assert.equal(error.message.includes("hunter2"), false);
    assert.equal(error.message.includes("private-session"), false);
    assert.equal(error.cause, undefined);
    return true;
  });
  await client.logout();
});

test("checkpoint and expired-session errors stop automatic authentication retries", async () => {
  for (const [message, expectedState, expectedCode] of [
    ["checkpoint required", "checkpoint", "FCA_CHECKPOINT_REQUIRED"],
    ["Session expired; not logged in", "logged_out", "FCA_SESSION_EXPIRED"]
  ]) {
    let attempts = 0;
    const client = createClient({
      authenticate: async () => { attempts++; throw new Error(message); },
      reconnect: { minDelayMs: 0, maxDelayMs: 0, jitter: 0, maxAttempts: 5 }
    });
    await assert.rejects(client.login({ mode: "appstate", appState }), error => {
      assert.equal(error.sessionState, expectedState);
      assert.equal(error.code, expectedCode);
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(attempts, 1);
    await client.logout();
  }
});

test("client facade exposes only methods implemented by its transport driver", async () => {
  const calls = [];
  const client = createClient({
    authenticate: async () => ({
      getCurrentUserID: () => 123456,
      sendMessage: async (...args) => { calls.push(args); return { messageID: "synthetic-1" }; },
      listen: () => () => {},
      disconnect: async () => {}
    })
  });

  const api = await client.login({ mode: "appstate", appState });
  assert.equal(api.getCurrentUserID(), "123456");
  assert.deepEqual(api.getCapabilities(), {
    methods: ["sendMessage", "getCurrentUserID"],
    events: true,
    sessionGuard: false,
    e2ee: false
  });
  assert.equal(typeof api.sendMessage, "function");
  assert.equal(api.getThreadInfo, undefined);
  assert.equal(api.createNewGroup, undefined);

  const result = await api.sendMessage("hello", "thread-1");
  assert.deepEqual(result, { messageID: "synthetic-1" });
  assert.deepEqual(calls, [["hello", "thread-1"]]);
  await client.logout();
});

test("listenMqtt uses the error-first callback and stopListening is idempotent", async () => {
  let eventHandler;
  let detachCount = 0;
  const client = createClient({
    authenticate: async () => ({
      getCurrentUserID: () => "123456",
      listen(callback) {
        eventHandler = callback;
        return () => { detachCount++; };
      },
      disconnect: async () => {}
    })
  });

  const api = await client.login({ mode: "appstate", appState });
  const received = [];
  api.listenMqtt((error, event) => received.push({ error, event }));

  const event = { type: "message", messageID: "synthetic-event" };
  eventHandler(null, event);
  eventHandler(new Error("synthetic socket error"));
  assert.equal(received.length, 2);
  assert.equal(received[0].error, null);
  assert.equal(received[0].event, event);
  assert.match(received[1].error.message, /synthetic socket error/);
  assert.equal(received[1].event, null);

  api.stopListening();
  api.stopListening();
  assert.equal(detachCount, 1);
  await client.logout();
});



test("client disposes a connected driver when identity initialization fails", async () => {
  let disconnected = 0;
  const failure = new Error("identity lookup failed");
  const client = createClient({
    authenticate: async () => ({
      listen: () => () => {},
      getCurrentUserID: async () => { throw failure; },
      disconnect: async () => { disconnected++; }
    })
  });

  await assert.rejects(
    client.login({ mode: "appstate", appState }),
    error => error === failure
  );
  assert.equal(disconnected, 1);
  assert.deepEqual(client.getConnectionState(), {
    state: "idle",
    connected: false,
    generation: 0
  });
});


test("concurrent login calls cannot create competing transport sessions", async () => {
  let beginAuthentication;
  let resolveAuthentication;
  const authenticationStarted = new Promise(resolve => { beginAuthentication = resolve; });
  const authentication = new Promise(resolve => { resolveAuthentication = resolve; });
  let disconnects = 0;

  const client = createClient({
    authenticate: async () => {
      beginAuthentication();
      return authentication;
    }
  });

  const firstLogin = client.login({ mode: "appstate", appState });
  await authenticationStarted;
  await assert.rejects(
    client.login({ mode: "appstate", appState }),
    /already in progress/
  );

  resolveAuthentication({
    getCurrentUserID: () => "123456",
    listen: () => () => {},
    disconnect: async () => { disconnects++; }
  });

  const api = await firstLogin;
  assert.equal(api.getCurrentUserID(), "123456");
  await client.logout();
  assert.equal(disconnects, 1);
});


test("logout during authentication waits and disposes the session", async () => {
  let resolveAuthentication;
  let authenticationStarted;
  const started = new Promise(resolve => { authenticationStarted = resolve; });
  const pending = new Promise(resolve => { resolveAuthentication = resolve; });
  let disconnects = 0;

  const client = createClient({
    authenticate: async () => {
      authenticationStarted();
      return pending;
    }
  });

  const loggingIn = client.login({ mode: "appstate", appState });
  await started;
  const loggingOut = client.logout();
  await assert.rejects(
    client.login({ mode: "appstate", appState }),
    /Logout is already in progress/
  );

  resolveAuthentication({
    getCurrentUserID: () => "123456",
    listen: () => () => {},
    disconnect: async () => { disconnects++; }
  });

  await loggingIn;
  await loggingOut;
  assert.equal(disconnects, 1);
  assert.deepEqual(client.getConnectionState(), {
    state: "idle",
    connected: false,
    generation: 0
  });
});


test("client disposes a provider result that violates the transport contract", async () => {
  let disconnects = 0;
  const client = createClient({
    authenticate: async () => ({
      listen: "not-a-function",
      disconnect: async () => { disconnects++; }
    })
  });
  await assert.rejects(
    client.login({ mode: "appstate", appState }),
    /missing required method: listen/
  );
  assert.equal(disconnects, 1);
  await client.logout();
});
