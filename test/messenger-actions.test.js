"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createMessengerSendMessageRequest, offlineThreadingId } = require("../src/transport/messengerActions");

test("builds Messenger MQTT text, reply and read-watermark tasks", () => {
  const request = createMessengerSendMessageRequest({
    threadID: "123456789", message: "hello", replyToMessageID: "mid.1",
    timestamp: 1700000000000, otid: "1700000000000123", epochId: "1700000000000456"
  });
  assert.equal(request.app_id, "2220391788200892");
  assert.equal(request.type, 3);
  const payload = JSON.parse(request.payload);
  assert.equal(payload.version_id, "6120284488008082");
  assert.equal(payload.tasks[0].label, "46");
  const send = JSON.parse(payload.tasks[0].payload);
  assert.equal(send.thread_id, "123456789");
  assert.equal(send.text, "hello");
  assert.equal(send.reply_metadata.reply_source_id, "mid.1");
  assert.equal(JSON.parse(payload.tasks[1].payload).last_read_watermark_ts, 1700000000000);
});

test("builds sticker task and rejects unverified attachment uploads", () => {
  const request = createMessengerSendMessageRequest({
    threadID: 123456789, message: { sticker: "42" }, timestamp: 1700000000000,
    otid: "1700000000000123", epochId: "1700000000000456"
  });
  const task = JSON.parse(JSON.parse(request.payload).tasks[0].payload);
  assert.equal(task.send_type, 2);
  assert.equal(task.sticker_id, "42");
  assert.equal(task.text, null);
  assert.throws(() => createMessengerSendMessageRequest({ threadID: "123456789", message: { body: "x", attachment: [] } }), /verified upload flow/);
});

test("offline IDs are numeric and input validation is strict", () => {
  assert.match(offlineThreadingId(1700000000000, 1234), /^\d+$/);
  assert.throws(() => createMessengerSendMessageRequest({ threadID: "bad", message: "x" }), /numeric Facebook ID/);
  assert.throws(() => createMessengerSendMessageRequest({ threadID: "123456789", message: "x".repeat(20001) }), /exceeds/);
});
