"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("../src/api/client");

const appState = [
  { key: "c_user", value: "123456", domain: "facebook.com" },
  { key: "xs", value: "synthetic-session-value", domain: "facebook.com" }
];

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
