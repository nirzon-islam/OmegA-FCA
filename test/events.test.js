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
