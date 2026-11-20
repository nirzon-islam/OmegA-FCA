"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mqtt = require("../src/transport/mqtt311Codec");

test("MQTT remaining length round-trips boundary values", () => {
  for (const value of [0, 1, 127, 128, 16383, 16384, 2097151, 2097152, mqtt.MAX_REMAINING_LENGTH]) {
    const encoded = mqtt.encodeRemainingLength(value);
    const packet = Buffer.concat([Buffer.from([0x30]), encoded]);
    const decoded = mqtt.decodeRemainingLength(packet);
    assert.equal(decoded.value, value);
    assert.equal(decoded.bytes, encoded.length);
  }
});

test("MQTT CONNECT encodes protocol name, version and client id", () => {
  const packet = mqtt.encodeConnect({ clientId: "omega-test", keepAlive: 30 });
  assert.equal(packet[0], 0x10);
  assert.equal(packet.toString("ascii", 4, 8), "MQTT");
  assert.equal(packet[8], 4);
  assert.equal(packet.readUInt16BE(packet.length - 12), 10);
  assert.equal(packet.toString("utf8", packet.length - 10), "omega-test");
});

test("MQTT PUBLISH QoS 1 round-trips topic, packet id and payload", () => {
  const encoded = mqtt.encodePublish({
    topic: "omega/test",
    payload: Buffer.from("hello"),
    qos: 1,
    packetId: 42
  });
  const decoded = mqtt.decodePacket(encoded);
  assert.equal(decoded.type, "publish");
  assert.equal(decoded.topic, "omega/test");
  assert.equal(decoded.qos, 1);
  assert.equal(decoded.packetId, 42);
  assert.equal(decoded.payload.toString(), "hello");
});

test("MQTT SUBSCRIBE and PUBACK have valid fixed headers", () => {
  const subscribe = mqtt.encodeSubscribe(9, [{ topic: "omega/events", qos: 1 }]);
  assert.equal(subscribe[0], 0x82);
  const ack = mqtt.encodePacketId("puback", 9);
  assert.deepEqual(mqtt.decodePacket(ack), { type: "puback", packetId: 9 });
});

test("MQTT decoder rejects invalid fixed-header flags and oversized packets", () => {
  assert.throws(() => mqtt.decodePacket(Buffer.from([0x81, 0x00])));
  assert.throws(() => mqtt.decodePacket(Buffer.from([0xc0, 0x00]), { maxPacketBytes: 1 }));
});

test("MQTT CONNECT refuses password without username", () => {
  assert.throws(() => mqtt.encodeConnect({ clientId: "x", password: "secret" }));
});
