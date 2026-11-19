"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeFacebookResponse, stripFacebookJsonPrefix } = require("../src/auth/facebookResponse");

test("normalizes Facebook anti-JSON prefix", () => {
  assert.deepEqual(normalizeFacebookResponse('for (;;);{"payload":{"ok":true}}'), { payload: { ok: true } });
  assert.equal(stripFacebookJsonPrefix(")]}',{\"ok\":true}"), '{"ok":true}');
});

test("maps checkpoint and expired-session responses to permanent errors", () => {
  assert.throws(
    () => normalizeFacebookResponse('{"error":{"message":"checkpoint_required"}}'),
    error => error.code === "FCA_CHECKPOINT_REQUIRED" && error.sessionState === "checkpoint" && error.retryable === false
  );
  assert.throws(
    () => normalizeFacebookResponse('{"error":{"message":"login_required"}}'),
    error => error.code === "FCA_SESSION_EXPIRED" && error.sessionState === "logged_out"
  );
});

test("maps rate limits and upstream failures to retryable errors", () => {
  assert.throws(
    () => normalizeFacebookResponse("rate limited", { status: 429 }),
    error => error.code === "FCA_RATE_LIMITED" && error.retryable === true
  );
  assert.throws(
    () => normalizeFacebookResponse("unavailable", { status: 503 }),
    error => error.code === "FCA_UPSTREAM_UNAVAILABLE" && error.retryable === true
  );
});

test("returns valid success payload and rejects invalid response formats", () => {
  assert.deepEqual(normalizeFacebookResponse('{"data":{"message_id":"m1"}}'), { data: { message_id: "m1" } });
  assert.throws(() => normalizeFacebookResponse("<html>oops</html>"), { code: "FCA_RESPONSE_NOT_JSON" });
  assert.throws(() => normalizeFacebookResponse("x".repeat(8 * 1024 * 1024 + 1)), { code: "FCA_RESPONSE_INVALID" });
});
