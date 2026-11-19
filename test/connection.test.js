"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ConnectionSupervisor } = require("../src/runtime/connection");

test("connection supervisor prevents duplicate listeners", async () => {
  let registered = 0;
  let callback;
  const supervisor = new ConnectionSupervisor({
    connect: async () => ({ listen(fn) { registered++; callback = fn; return () => { registered--; }; } }),
    disconnect: async () => {}
  });
  await supervisor.start();
  const received = [];
  const detach = supervisor.listen(event => received.push(event));
  assert.equal(registered, 1);
  assert.throws(() => supervisor.listen(() => {}), /already attached/);
  callback(null, { type: "message", messageID: "m1" });
  assert.equal(received.length, 1);
  detach();
  assert.equal(registered, 0);
  await supervisor.stop();
  assert.equal(supervisor.snapshot().state, "stopped");
});

test("stop invalidates stale listener callbacks", async () => {
  let callback;
  const supervisor = new ConnectionSupervisor({ connect: async () => ({ listen(fn) { callback = fn; } }) });
  await supervisor.start();
  const received = [];
  supervisor.listen(event => received.push(event));
  await supervisor.stop();
  callback(null, { type: "message" });
  assert.equal(received.length, 0);
});
