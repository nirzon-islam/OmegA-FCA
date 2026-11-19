"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encryptSession, decryptSession } = require("../src/security/sessionCrypto");

const key = "a".repeat(64);

test("encrypts and decrypts session data with AES-256-GCM", () => {
  const session = { accountId: "123456", appState: [{ key: "xs", value: "synthetic" }] };
  const encrypted = encryptSession(session, key);
  assert.equal(JSON.stringify(encrypted).includes("synthetic"), false);
  assert.deepEqual(decryptSession(encrypted, key), session);
});

test("rejects tampering and incorrect encryption keys", () => {
  const encrypted = encryptSession({ accountId: "123456" }, key);
  const tampered = { ...encrypted, data: Buffer.from("tampered").toString("base64url") };
  assert.throws(() => decryptSession(tampered, key));
  assert.throws(() => decryptSession(encrypted, "b".repeat(64)));
});
