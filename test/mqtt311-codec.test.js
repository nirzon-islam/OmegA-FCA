"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mqtt = require("../src/transport/mqtt311Codec");

test("encodes and decodes MQTT remaining length boundaries", () => {
  for (const value of [0, 1, 127, 128, 16383, 16384, 2097151, 2097152, mqtt.MAX_REMAINING_LENGTH]) {
    const encoded = mqtt.encodeRemainingLength(value);
    const packet = Buffer.concat([Buffer.from([0xc0]), encoded]);
    const decoded = mqtt.decodeRemainingLength(packet);
    assert.equal(decoded.value, value);
    assert.equal(decoded.offset, packet.length);
  }
  assert.equal(mqtt.decodeRemainingLength(Buffer.from([0xc0, 0x80])), null);
  assert.throws(() => mqtt.decodeRemainingLength(Buffer.from([0xc0, 0x80, 0x80, 0x80, 0x80, 0x00])), /Malformed/);
});

test("encodes MQTT 3.1.1 CONNECT with required protocol header", () => {
  const packet = mqtt.encodeConnect({ clientId: "omega-test", keepAlive: 30 });
  assert.equal(packet[0], 0x10);
  const remaining = mqtt.decodeRemainingLength(packet);
  assert.equal(packet.toString("ascii", remaining.offset + 2, remaining.offset + 6), "MQTT");
  assert.equal(packet[remaining.offset + 6], 4);
});

test("encodes PUBLISH with QoS 0 and QoS 1 packet identifiers", () => {
  const qos0 = mqtt.encodePublish({ topic: "fixture/topic", payload: "hello" });
  const decoded0 = mqtt.decodePacket(qos0);
  assert.equal(decoded0.type, "publish");
  assert.equal(decoded0.topic, "fixture/topic");
  assert.equal(decoded0.qos, 0);
  assert.equal(decoded0.payload.toString(), "hello");

  const qos1 = mqtt.encodePublish({ topic: "fixture/topic", payload: Buffer.from([1, 2]), qos: 1, packetId: 42 });
  const decoded1 = mqtt.decodePacket(qos1);
  assert.equal(decoded1.qos, 1);
  assert.equal(decoded1.packetId, 42);
  assert.deepEqual(decoded1.payload, Buffer.from([1, 2]));
});

test("encodes SUBSCRIBE and acknowledgement/control packets", () => {
  const subscribe = mqtt.encodeSubscribe(7, [{ topic: "fixture/one", qos: 0 }, { topic: "fixture/two", qos: 1 }]);
  assert.equal(subscribe[0], 0x82);
  const ping = mqtt.encodePingReq();
  assert.deepEqual(mqtt.decodePacket(ping), { type: "pingreq" });
  assert.deepEqual(mqtt.decodePacket(Buffer.from([0xd0, 0x00])), { type: "pingresp" });
  assert.deepEqual(mqtt.decodePacket(mqtt.encodePacketId("puback", 7)), { type: "puback", packetId: 7 });
  assert.deepEqual(mqtt.decodePacket(mqtt.encodeDisconnect()), { type: "disconnect" });
});

test("rejects invalid packet identifiers, topics and malformed headers", () => {
  assert.throws(() => mqtt.encodeSubscribe(0, [{ topic: "a" }]), /packetId/);
  assert.throws(() => mqtt.encodePublish({ topic: "bad/#/topic", payload: "x" }), /topic/);
  assert.throws(() => mqtt.encodePacketId("puback", 0), /packetId/);
  assert.throws(() => mqtt.decodePacket(Buffer.from([0x60, 0x02, 0x00, 0x01])), /fixed-header flags/);
});
