"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createLicenseProvider } = require("../src/license/provider");

test("refreshes a license over HTTPS and validates the returned signature", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "OmegA-License-Service",
    aud: "OmegA-FCA",
    licenseId: "lic_0123456789abcdef0123456789abcdef",
    ownerId: "owner-test",
    installationId: "install-test",
    iat: now,
    exp: now + 900,
    features: ["messaging"]
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  const token = bytes.toString("base64url") + "." + crypto.sign(null, bytes, privateKey).toString("base64url");
  let request;
  const provider = createLicenseProvider({
    backendUrl: "https://agent.example.com",
    licenseId: payload.licenseId,
    installationId: payload.installationId,
    licenseKey: "k".repeat(43),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    fetchImpl: async (url, options) => {
      request = { url: String(url), body: JSON.parse(options.body) };
      return { ok: true, status: 200, json: async () => ({ success: true, token }) };
    }
  });
  assert.equal(await provider(), token);
  assert.equal(request.url, "https://agent.example.com/api/fca-license/refresh");
  assert.equal(request.body.licenseId, payload.licenseId);
});

test("rejects insecure non-local license backend URLs", () => {
  assert.throws(() => createLicenseProvider({
    backendUrl: "http://agent.example.com",
    licenseId: "lic_0123456789abcdef0123456789abcdef",
    installationId: "install-test",
    licenseKey: "k".repeat(43),
    publicKey: "unused"
  }), /HTTPS/);
});
