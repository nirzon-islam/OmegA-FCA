"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { saveSession, loadSession, deleteSession } = require("../src/security/sessionStore");
const { classifySessionState, describeError } = require("../src/security/sessionState");

test("encrypted session store round-trips and removes files", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-test-"));
  const file = path.join(directory, "session.enc");
  const key = "a".repeat(64);
  const session = { userId: "123456", cookies: [{ key: "xs", value: "synthetic" }] };
  try {
    assert.equal(saveSession(file, session, key), file);
    const stats = fs.statSync(file);
    if (process.platform !== "win32") assert.equal(stats.mode & 0o777, 0o600);
    assert.deepEqual(loadSession(file, key), session);
    assert.throws(() => loadSession(file, "b".repeat(64)));
    deleteSession(file);
    assert.equal(fs.existsSync(file), false);
    assert.doesNotThrow(() => deleteSession(file));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("session store rejects malformed and oversized files", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-test-"));
  const file = path.join(directory, "bad.enc");
  try {
    fs.writeFileSync(file, "{bad");
    assert.throws(() => loadSession(file, "a".repeat(64)));
    fs.writeFileSync(file, "x".repeat(1024 * 1024 + 1));
    assert.throws(() => loadSession(file, "a".repeat(64)), /too large/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("session state classifier separates checkpoints, logout and transient errors", () => {
  assert.equal(classifySessionState(null), "unknown");
  assert.equal(classifySessionState({ message: "checkpoint required" }), "checkpoint");
  assert.equal(classifySessionState({ code: "1357001", message: "not logged in" }), "logged_out");
  assert.equal(classifySessionState({ message: "ETIMEDOUT" }), "error");
  assert.equal(classifySessionState("online"), "online");
  assert.equal(describeError({ type: "Auth", message: "expired" }), "Auth expired");
});


test("session encryption rejects oversized plaintext and malformed base64url envelopes", () => {
  const { encryptSession, decryptSession } = require("../src/security/sessionCrypto");
  const key = "c".repeat(64);
  assert.throws(
    () => encryptSession({ payload: "x".repeat(1024 * 1024) }, key),
    /1 MiB limit/
  );

  const envelope = encryptSession({ userId: "123456" }, key);
  assert.throws(
    () => decryptSession({ ...envelope, iv: "not+base64url" }, key),
    /Invalid encrypted session envelope/
  );
  assert.throws(
    () => decryptSession({ ...envelope, tag: "A" }, key),
    /Invalid encrypted session envelope/
  );
});
