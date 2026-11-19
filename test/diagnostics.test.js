"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDiagnosticRecorder } = require("../src/security/diagnostics");

test("diagnostic recorder keeps request structure but never values or secrets", () => {
  const recorder = createDiagnosticRecorder({ clock: () => 1_800_000_000_000 });
  recorder.record({
    phase: "response",
    request: {
      url: "https://www.facebook.com/api/path?fb_dtsg=VERY_SECRET&mode=send&access_token=ALSO_SECRET",
      method: "POST",
      headers: { cookie: "c_user=SECRET; xs=SECRET", authorization: "Bearer SECRET", accept: "application/json" },
      body: new URLSearchParams({ action: "send", fb_dtsg: "SECRET", body: "hello private message", password: "SECRET" })
    },
    response: { status: 200, contentType: "application/json; charset=utf-8", bodyBytes: 128 },
    durationMs: 42
  });
  const json = recorder.toJSON();
  for (const secret of ["VERY_SECRET", "ALSO_SECRET", "SECRET", "hello private message", "c_user=", "Bearer"]) {
    assert.equal(json.includes(secret), false, "report leaked " + secret);
  }
  const report = JSON.parse(json);
  assert.equal(report.events[0].method, "POST");
  assert.equal(report.events[0].status, 200);
  assert.deepEqual(report.events[0].requestFieldNames, ["action", "body"]);
  assert.equal(report.events[0].sensitiveFieldCount, 2);
  assert.deepEqual(report.events[0].url.queryParameterNames, ["mode"]);
  assert.deepEqual(report.events[0].requestHeaders, ["accept"]);
});

test("diagnostic recorder bounds event count and supports clear", () => {
  const recorder = createDiagnosticRecorder({ maxEvents: 2, clock: () => 0 });
  recorder.record({ request: { url: "https://www.facebook.com/one", method: "GET" } });
  recorder.record({ request: { url: "https://www.facebook.com/two", method: "GET" } });
  recorder.record({ request: { url: "https://www.facebook.com/three", method: "GET" } });
  assert.equal(recorder.snapshot().events.length, 2);
  assert.equal(recorder.snapshot().events[0].url.path, "/two");
  recorder.clear();
  assert.equal(recorder.snapshot().events.length, 0);
});

test("diagnostic recorder rejects unsafe event limits", () => {
  assert.throws(() => createDiagnosticRecorder({ maxEvents: 0 }), /between 1 and 1000/);
});
