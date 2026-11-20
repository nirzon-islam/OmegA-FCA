"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mqtt = require("../src/transport/mqtt311Codec");
const { createMqtt311StreamDecoder } = require("../src/transport/mqtt311StreamDecoder");

test("stream decoder handles split MQTT packets", () => {
  const decoder = createMqtt311StreamDecoder();
  const packet = mqtt.encodePublish({ topic: "omega/events", payload: "hello" });
  assert.deepEqual(decoder.push(packet.subarray(0, 3)), []);
  assert.equal(decoder.bufferedBytes, 3);
  const decoded = decoder.push(packet.subarray(3));
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].type, "publish");
  assert.equal(decoded[0].payload.toString(), "hello");
  assert.equal(decoder.bufferedBytes, 0);
});

test("stream decoder emits multiple packets from one chunk", () => {
  const decoder = createMqtt311StreamDecoder();
  const packets = decoder.push(Buffer.concat([mqtt.encodePingReq(), mqtt.encodeDisconnect()]));
  assert.deepEqual(packets.map(packet => packet.type), ["pingreq", "disconnect"]);
});

test("stream decoder enforces packet and buffer limits", () => {
  const decoder = createMqtt311StreamDecoder({ maxPacketBytes: 8, maxBufferedBytes: 8 });
  assert.throws(() => decoder.push(Buffer.from([0x30, 0x7f])), /size limit/);
  assert.equal(decoder.bufferedBytes, 0);
});

test("stream decoder can reset and close", () => {
  const decoder = createMqtt311StreamDecoder();
  decoder.push(Buffer.from([0x30, 0x05, 0x00]));
  decoder.reset();
  assert.equal(decoder.bufferedBytes, 0);
  decoder.close();
  assert.throws(() => decoder.push(Buffer.alloc(0)), /closed/);
});
