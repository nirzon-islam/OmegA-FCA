"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventDispatcher } = require("../src/events/dispatcher");
const { validateTransportDriver, createTransportFactory } = require("../src/transport/contract");

test("dispatcher suppresses duplicate message IDs", async () => {
  const dispatcher = new EventDispatcher();
  let count = 0;
  const handler = async () => ++count;
  const first = await dispatcher.dispatch({ messageID: "m-1", threadID: "t-1" }, handler);
  const second = await dispatcher.dispatch({ messageID: "m-1", threadID: "t-1" }, handler);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(count, 1);
});

test("dispatcher preserves order within a thread and isolates other threads", async () => {
  const dispatcher = new EventDispatcher();
  const order = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = dispatcher.dispatch({ messageID: "a", threadID: "same" }, async () => {
    order.push("a:start");
    await gate;
    order.push("a:end");
  });
  const second = dispatcher.dispatch({ messageID: "b", threadID: "same" }, async () => order.push("b"));
  const other = dispatcher.dispatch({ messageID: "c", threadID: "other" }, async () => order.push("other"));
  await other;
  assert.deepEqual(order, ["a:start", "other"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["a:start", "other", "a:end", "b"]);
});

test("dispatcher expires old duplicate keys and bounds its cache", async () => {
  let now = 100;
  const dispatcher = new EventDispatcher({ maxSeen: 2, ttlMs: 10, now: () => now });
  let calls = 0;
  const run = id => dispatcher.dispatch({ messageID: id }, async () => ++calls);
  await run("1");
  await run("2");
  await run("3");
  await run("3");
  assert.equal(calls, 3);
  now += 11;
  await run("3");
  assert.equal(calls, 4);
});

test("dispatcher rejects malformed calls and continues after handler failure", async () => {
  const dispatcher = new EventDispatcher();
  await assert.rejects(dispatcher.dispatch(null, () => {}), /event and handler/);
  await assert.rejects(dispatcher.dispatch({}, null), /event and handler/);
  await assert.rejects(dispatcher.dispatch({ threadID: "t" }, async () => { throw new Error("expected"); }), /expected/);
  const result = await dispatcher.dispatch({ threadID: "t" }, async () => "ok");
  assert.equal(result.result, "ok");
});

test("transport contract requires listen and validates optional method types", () => {
  assert.throws(() => validateTransportDriver(null), /driver object/);
  assert.throws(() => validateTransportDriver({}), /listen/);
  assert.throws(() => validateTransportDriver({ listen() {}, sendMessage: true }), /must be a function/);
  const driver = { listen() {}, sendMessage: async () => "sent" };
  assert.equal(validateTransportDriver(driver), driver);
});

test("transport factory validates the provider result", async () => {
  const factory = createTransportFactory(async context => {
    assert.equal(context.account, "synthetic");
    return { listen() {} };
  });
  const driver = await factory({ account: "synthetic" });
  assert.equal(typeof driver.listen, "function");
  const invalid = createTransportFactory(async () => ({}));
  await assert.rejects(invalid({}), /listen/);
  assert.throws(() => createTransportFactory(null), /provider must be a function/);
});
