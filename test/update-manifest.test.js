"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { compareVersions, verifyUpdateManifest, verifyArtifactDigest } = require("../src/update/manifest");

function signedManifest(privateKey, overrides = {}) {
  const now = Date.now();
  const value = {
    product: "@omegax/fca",
    version: "0.2.0",
    channel: "stable",
    minNode: "20.0.0",
    issuedAt: now - 1000,
    expiresAt: now + 60000,
    releaseNotes: "Security and compatibility improvements.",
    artifact: { url: "https://releases.example.com/omegax-fca-0.2.0.tgz", sha256: crypto.createHash("sha256").update("fixture").digest("hex") },
    ...overrides
  };
  const payload = Buffer.from(JSON.stringify(value));
  return { payload: payload.toString("base64url"), signature: crypto.sign(null, payload, privateKey).toString("base64url") };
}

test("compares semantic versions including prereleases", () => {
  assert.equal(compareVersions("1.2.0", "1.1.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0-rc.1"), 1);
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.10"), -1);
});

test("accepts a valid signed manifest and reports update availability", () => {
  const keys = crypto.generateKeyPairSync("ed25519");
  const envelope = signedManifest(keys.privateKey);
  const result = verifyUpdateManifest(envelope, {
    publicKey: keys.publicKey,
    currentVersion: "0.1.0",
    allowedHosts: ["releases.example.com"]
  });
  assert.equal(result.updateAvailable, true);
  assert.equal(result.version, "0.2.0");
});

test("rejects invalid signatures, expired manifests and unapproved hosts", () => {
  const keys = crypto.generateKeyPairSync("ed25519");
  const other = crypto.generateKeyPairSync("ed25519");
  const envelope = signedManifest(keys.privateKey);
  assert.throws(() => verifyUpdateManifest(envelope, { publicKey: other.publicKey, allowedHosts: ["releases.example.com"] }), /signature/);
  assert.throws(() => verifyUpdateManifest(signedManifest(keys.privateKey, { expiresAt: Date.now() - 1 }), { publicKey: keys.publicKey, allowedHosts: ["releases.example.com"] }), /expired/);
  assert.throws(() => verifyUpdateManifest(envelope, { publicKey: keys.publicKey, allowedHosts: ["example.org"] }), /not allowed/);
});

test("rejects product mismatch and non-HTTPS artifact URLs", () => {
  const keys = crypto.generateKeyPairSync("ed25519");
  assert.throws(() => verifyUpdateManifest(signedManifest(keys.privateKey, { product: "other" }), { publicKey: keys.publicKey, allowedHosts: ["releases.example.com"] }), /product mismatch/);
  assert.throws(() => verifyUpdateManifest(signedManifest(keys.privateKey, { artifact: { url: "http://releases.example.com/file", sha256: "a".repeat(64) } }), { publicKey: keys.publicKey, allowedHosts: ["releases.example.com"] }), /HTTPS/);
});

test("checks artifact SHA-256 without downloading or executing it", () => {
  const bytes = Buffer.from("fixture");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(verifyArtifactDigest(bytes, digest), true);
  assert.equal(verifyArtifactDigest(Buffer.from("tampered"), digest), false);
});
