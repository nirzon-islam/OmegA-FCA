"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMessengerSyncCursorStore } = require("../src/transport/messengerSyncCursorStore");
const { createFacebookMqttProtocol } = require("../src/transport/facebookMqttProtocol");
const mqtt = require("../src/transport/mqtt311Codec");

test("persists encrypted account-bound sync cursors and reloads them", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-cursor-"));
  const filePath = path.join(directory, "cursor.enc");
  const key = "a".repeat(64);
  try {
    const store = createMessengerSyncCursorStore({ filePath, key, userId: "123456789" });
    assert.equal(store.load(), null);
    store.save({ syncToken: "private-sync-token", lastSeqId: "42" });
    const contents = fs.readFileSync(filePath, "utf8");
    assert.equal(contents.includes("private-sync-token"), false);
    assert.deepEqual(createMessengerSyncCursorStore({ filePath, key, userId: "123456789" }).load(),
      { syncToken: "private-sync-token", lastSeqId: "42" });
    assert.throws(() => createMessengerSyncCursorStore({ filePath, key, userId: "987654321" }).load(), /different account/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("cursor store rejects invalid cursor values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-cursor-"));
  try {
    const store = createMessengerSyncCursorStore({ filePath: path.join(directory, "cursor.enc"), key: "b".repeat(64), userId: "123456789" });
    assert.throws(() => store.save({ syncToken: "", lastSeqId: null }), /cursor must contain/);
    assert.throws(() => store.save({ syncToken: null, lastSeqId: -1 }), /lastSeqId/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("protocol uses stored cursor for diff bootstrap and persists new cursor", () => {
  const saved = [];
  const store = { load: () => ({ syncToken: "old-token", lastSeqId: "4" }), save: value => { saved.push(value); } };
  const config = createFacebookMqttProtocol({ userId: "123456789", syncCursorStore: store });
  const sent = [];
  const socket = { send: frame => sent.push(Buffer.from(frame)) };
  const context = { waitForFrame: async () => { const remaining = mqtt.decodeRemainingLength(sent[0]); const packetId = sent[0].readUInt16BE(remaining.offset); return Buffer.from([0x90, 0x03, packetId >> 8, packetId & 0xff, 0x01]); } };
  return config.protocol.subscribe(socket, context).then(() => {
    const queue = mqtt.decodePacket(sent[1]);
    assert.equal(queue.topic, "/messenger_sync_get_diffs");
    const queuePayload = JSON.parse(queue.payload.toString());
    assert.equal(queuePayload.sync_token, "old-token");
    assert.equal(queuePayload.last_seq_id, "4");
    const packet = mqtt.encodePublish({ topic: "/t_ms", payload: JSON.stringify({
      deltas: [{ class: "NewMessage", body: "hi" }], sync_token: "new-token", last_seq_id: "5"
    }), qos: 0 });
    const decoded = config.protocol.decodeFrame(packet);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0], { syncToken: "new-token", lastSeqId: "5" });
    assert.equal(decoded.events.at(-1).type, "sync_cursor");
  });
});

test("protocol sendMessage wraps the task builder in a correlated request", async () => {
  const config = createFacebookMqttProtocol({ userId: "123456789" });
  const sent = [];
  const socket = { send: frame => sent.push(Buffer.from(frame)) };
  const pending = config.protocol.sendMessage(socket, { threadID: "987654321", message: "hello" });
  const packet = mqtt.decodePacket(sent[0]);
  assert.equal(packet.topic, "/ls_req");
  const request = JSON.parse(packet.payload.toString());
  assert.equal(request.app_id, "2220391788200892");
  assert.equal(request.type, 3);
  assert.equal(typeof request.request_id, "number");
  const response = { request_id: request.request_id, payload: JSON.stringify({ ok: true }) };
  config.protocol.decodeFrame(mqtt.encodePublish({ topic: "/ls_resp", payload: JSON.stringify(response), qos: 0 }));
  assert.deepEqual(await pending, response);
});
