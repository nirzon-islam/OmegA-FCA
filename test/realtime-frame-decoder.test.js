"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeRealtimeFrame, summarizeRealtimeFrame } = require("../src/transport/realtimeFrameDecoder");

test("decodes a JSON events envelope after an opaque binary prefix", () => {
  const frame = Buffer.concat([
    Buffer.from([0x0d, 0x00, 0x00, 0x38, 0x04, 0x00, 0x47, 0x80]),
    Buffer.from(JSON.stringify({ events: [{ name: "sample_event", args: { value: 1 } }] }))
  ]);
  const decoded = decodeRealtimeFrame(frame);
  assert.equal(decoded.events.length, 1);
  assert.equal(decoded.events[0].name, "sample_event");
  assert.deepEqual(decoded.events[0].args, { value: 1 });
});

test("summarizes event names without returning payload values", () => {
  const frame = Buffer.from(JSON.stringify({
    events: [{ name: "one", args: { secret: "not-in-summary" } }, { name: "two" }]
  }));
  const summary = summarizeRealtimeFrame(frame);
  assert.deepEqual(summary, { eventCount: 2, eventNames: ["one", "two"] });
  assert.equal(JSON.stringify(summary).includes("not-in-summary"), false);
});

test("rejects malformed, unsupported, empty and oversized frames", () => {
  assert.throws(() => decodeRealtimeFrame(Buffer.alloc(0)), { code: "FCA_REALTIME_FRAME_SIZE_INVALID" });
  assert.throws(() => decodeRealtimeFrame(Buffer.from("not a frame")), { code: "FCA_REALTIME_FRAME_ENVELOPE_UNSUPPORTED" });
  assert.throws(() => decodeRealtimeFrame(Buffer.from(JSON.stringify({ events: [{ args: {} }] }))), {
    code: "FCA_REALTIME_FRAME_ENVELOPE_UNSUPPORTED"
  });
  assert.throws(() => decodeRealtimeFrame(Buffer.alloc(8), { maxFrameBytes: 4 }), {
    code: "FCA_REALTIME_FRAME_SIZE_INVALID"
  });
});

test("rejects invalid options and input types", () => {
  assert.throws(() => decodeRealtimeFrame("text"), /Buffer or Uint8Array/);
  assert.throws(() => decodeRealtimeFrame(Buffer.from("{}"), { maxFrameBytes: 0 }), /maxFrameBytes/);
});
