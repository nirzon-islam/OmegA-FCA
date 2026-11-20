"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectRealtimeSyncEnvelope } = require("../src/transport/realtimeSyncEnvelope");

function frame(payload, requestId = 7, type = 1) {
  const envelope = {
    app_id: "test-app",
    payload: JSON.stringify(payload),
    request_id: requestId,
    type
  };
  return Buffer.concat([Buffer.from([0x0f, 0x03, 0x00, 0x02]), Buffer.from(JSON.stringify(envelope))]);
}

test("inspects observed sync envelope and nested JSON payload", () => {
  const decoded = inspectRealtimeSyncEnvelope(frame({
    database: 2,
    epoch_id: "7529401378821970460",
    failure_count: null,
    last_applied_cursor: null,
    sync_params: { locale: "en_GB" },
    version: 29076686782003632
  }));
  assert.equal(decoded.requestId, 7);
  assert.equal(decoded.type, 1);
  assert.equal(decoded.payload.database, 2);
  assert.equal(decoded.payload.sync_params.locale, "en_GB");
});

test("rejects a one-byte control frame without inventing its meaning", () => {
  assert.throws(() => inspectRealtimeSyncEnvelope(Buffer.from([0x0a])), {
    code: "FCA_REALTIME_SYNC_ENVELOPE_MISSING"
  });
});

test("rejects malformed nested payload JSON", () => {
  const envelope = { app_id: "test-app", payload: "{", request_id: 1, type: 1 };
  const bytes = Buffer.concat([Buffer.from([0x0f]), Buffer.from(JSON.stringify(envelope))]);
  assert.throws(() => inspectRealtimeSyncEnvelope(bytes), {
    code: "FCA_REALTIME_SYNC_PAYLOAD_INVALID"
  });
});

test("enforces frame size bound", () => {
  assert.throws(() => inspectRealtimeSyncEnvelope(Buffer.alloc(8), { maxFrameBytes: 4 }), {
    code: "FCA_REALTIME_SYNC_FRAME_SIZE_INVALID"
  });
});
