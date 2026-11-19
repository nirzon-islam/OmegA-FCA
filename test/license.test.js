"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifyLicenseToken } = require("../src/license/verify");

function issueToken(privateKey, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "OmegA-License-Service",
    aud: "OmegA-FCA",
    licenseId: "lic_test_0001",
    ownerId: "owner-test",
    installationId: "install-test",
    iat: now,
    exp: now + 3600,
    features: ["messaging"],
    ...overrides
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  const signature = crypto.sign(null, bytes, privateKey);
  return bytes.toString("base64url") + "." + signature.toString("base64url");
}

test("verifies a valid owner-signed Ed25519 license", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const token = issueToken(privateKey);
  const license = verifyLicenseToken(token, publicKey.export({ type: "spki", format: "pem" }).toString(), {
    installationId: "install-test",
    ownerId: "owner-test"
  });
  assert.equal(license.licenseId, "lic_test_0001");
  assert.deepEqual(license.features, ["messaging"]);
});

test("rejects invalid signatures and mismatched installations", () => {
  const keys = crypto.generateKeyPairSync("ed25519");
  const other = crypto.generateKeyPairSync("ed25519");
  const token = issueToken(keys.privateKey);
  const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const otherPublicKey = other.publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.throws(() => verifyLicenseToken(token, otherPublicKey), /signature/);
  assert.throws(() => verifyLicenseToken(token, publicKey, { installationId: "another-install" }), /another installation/);
});

test("rejects expired licenses", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const now = Math.floor(Date.now() / 1000);
  const token = issueToken(privateKey, { iat: now - 3600, exp: now - 1 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.throws(() => verifyLicenseToken(token, pem), /not currently valid/);
});
