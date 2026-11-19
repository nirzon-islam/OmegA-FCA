"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createLicenseProvider } = require("../src/license/provider");

const base = {
  licenseId: "lic_0123456789abcdef0123456789abcdef",
  installationId: "install-test",
  licenseKey: "x".repeat(40),
  publicKey: "-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----"
};

test("license backend accepts HTTPS and local HTTP only", () => {
  assert.doesNotThrow(() => createLicenseProvider({ ...base, backendUrl: "https://licenses.example.com" }));
  assert.doesNotThrow(() => createLicenseProvider({ ...base, backendUrl: "http://localhost:3000" }));
  for (const backendUrl of [
    "http://licenses.example.com",
    "ftp://localhost",
    "https://user:pass@licenses.example.com",
    "https://licenses.example.com/?token=x",
    "https://licenses.example.com/#fragment"
  ]) {
    assert.throws(() => createLicenseProvider({ ...base, backendUrl }), /HTTPS|URL/);
  }
});
