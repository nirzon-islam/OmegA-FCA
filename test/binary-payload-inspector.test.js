"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectRealtimeBinaryPayload } = require("../src/transport/binaryPayloadInspector");

function frame(payload, request_id = null) {
  const encoded = Buffer.from(payload).toString("base64");
  return Buffer.concat([Buffer.from([0x0d, 0, 0, 0]), Buffer.from(JSON.stringify({ request_id, payload: encoded }))]);
}

test("summarizes a base64 protobuf-wire-compatible payload without exposing values", () => {
  // field 1, length-delimited, 2 bytes ("hi"); field 2, varint, value 7
  const result = inspectRealtimeBinaryPayload(frame(Buffer.from([0x0a, 0x02, 0x68, 0x69, 0x10, 0x07])));
  assert.equal(result.envelopeKind, "payload");
  assert.equal(result.requestIdPresent, false);
  assert.equal(result.payloadEncoding, "protobuf-wire-compatible");
  assert.equal(result.payloadBytes, 6);
  assert.deepEqual(result.wireFields, [
    { number: 1, wireType: 2, byteLength: 2 },
    { number: 2, wireType: 0, byteLength: null }
  ]);
  assert.equal(JSON.stringify(result).includes("hi"), false);
  assert.equal(JSON.stringify(result).includes("7"), false);
});

test("keeps unknown binary payloads opaque", () => {
  const result = inspectRealtimeBinaryPayload(frame(Buffer.from([0xff, 0xff, 0xff])));
  assert.equal(result.payloadEncoding, "base64-binary-unclassified");
  assert.deepEqual(result.wireFields, []);
});

test("enforces frame and payload limits and rejects unsupported envelopes", () => {
  assert.throws(() => inspectRealtimeBinaryPayload(Buffer.from("not a frame")), {
    code: "FCA_REALTIME_PAYLOAD_ENVELOPE_UNSUPPORTED"
  });
  assert.throws(() => inspectRealtimeBinaryPayload(frame(Buffer.alloc(20)), { maxPayloadBytes: 10 }), {
    code: "FCA_REALTIME_PAYLOAD_SIZE_INVALID"
  });
  assert.throws(() => inspectRealtimeBinaryPayload(Buffer.alloc(20), { maxFrameBytes: 10 }), {
    code: "FCA_REALTIME_FRAME_SIZE_INVALID"
  });
});
