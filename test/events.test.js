"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventDispatcher } = require("../src/events/dispatcher");

test("deduplicates repeated message IDs", async () => {
  const dispatcher = new EventDispatcher();
  let count = 0;
  const handler = async () => ++count;
  const event = { messageID: "m-1", threadID: "t-1" };
  assert.deepEqual(await dispatcher.dispatch(event, handler), { duplicate: false, result: 1 });
  assert.deepEqual(await dispatcher.dispatch(event, handler), { duplicate: true });
  assert.equal(count, 1);
});

test("processes events in order within each thread", async () => {
  const dispatcher = new EventDispatcher();
  const order = [];
  await Promise.all([
    dispatcher.dispatch({ messageID: "a", threadID: "same" }, async () => { await new Promise(r => setTimeout(r, 10)); order.push("a"); }),
    dispatcher.dispatch({ messageID: "b", threadID: "same" }, async () => { order.push("b"); })
  ]);
  assert.deepEqual(order, ["a", "b"]);
});

test("bounds the duplicate cache", async () => {
  const dispatcher = new EventDispatcher({ maxSeen: 2 });
  for (const id of ["a", "b", "c"]) await dispatcher.dispatch({ messageID: id }, async () => {});
  assert.equal(dispatcher.seen.size, 2);
});


test("coalesces concurrent duplicate deliveries while a handler is running", async () => {
  const dispatcher = new EventDispatcher();
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const event = { messageID: "concurrent-1", threadID: "thread-1" };
  const first = dispatcher.dispatch(event, async () => {
    calls++;
    await gate;
    return "processed";
  });
  const second = dispatcher.dispatch(event, async () => {
    calls++;
    return "duplicate-handler-ran";
  });
  release();
  assert.deepEqual(await first, { duplicate: false, result: "processed" });
  assert.deepEqual(await second, { duplicate: true });
  assert.equal(calls, 1);
});

test("does not permanently deduplicate an event whose handler failed", async () => {
  const dispatcher = new EventDispatcher();
  const event = { messageID: "retry-after-error", threadID: "thread-1" };
  await assert.rejects(dispatcher.dispatch(event, async () => {
    throw new Error("temporary handler failure");
  }), /temporary handler failure/);
  assert.deepEqual(await dispatcher.dispatch(event, async () => "recovered"), {
    duplicate: false,
    result: "recovered"
  });
});

test("validates duplicate cache options", () => {
  assert.throws(() => new EventDispatcher({ ttlMs: 0 }), /ttlMs/);
  assert.throws(() => new EventDispatcher({ ttlMs: Infinity }), /ttlMs/);
  assert.throws(() => new EventDispatcher({ now: 123 }), /now/);
});


test("coalesces concurrent duplicate deliveries while a handler is running", async () => {
  const dispatcher = new EventDispatcher();
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const event = { messageID: "concurrent-1", threadID: "thread-1" };
  const first = dispatcher.dispatch(event, async () => {
    calls++;
    await gate;
    return "processed";
  });
  const second = dispatcher.dispatch(event, async () => {
    calls++;
    return "duplicate-handler-ran";
  });
  release();
  assert.deepEqual(await first, { duplicate: false, result: "processed" });
  assert.deepEqual(await second, { duplicate: true });
  assert.equal(calls, 1);
});

test("does not permanently deduplicate an event whose handler failed", async () => {
  const dispatcher = new EventDispatcher();
  const event = { messageID: "retry-after-error", threadID: "thread-1" };
  await assert.rejects(dispatcher.dispatch(event, async () => {
    throw new Error("temporary handler failure");
  }), /temporary handler failure/);
  assert.deepEqual(await dispatcher.dispatch(event, async () => "recovered"), {
    duplicate: false,
    result: "recovered"
  });
});

test("validates duplicate cache options", () => {
  assert.throws(() => new EventDispatcher({ ttlMs: 0 }), /ttlMs/);
  assert.throws(() => new EventDispatcher({ ttlMs: Infinity }), /ttlMs/);
  assert.throws(() => new EventDispatcher({ now: 123 }), /now/);
});
