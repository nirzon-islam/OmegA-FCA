"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generateTotp } = require("../src/auth/totp");

test("generates RFC 6238 SHA-1 test vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(generateTotp(secret, { timestamp: 59_000 }), "287082");
});

test("supports 8 digit RFC vector and configurable period", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(generateTotp(secret, { timestamp: 59_000, digits: 8 }), "94287082");
});

test("rejects invalid secret and options", () => {
  assert.throws(() => generateTotp("not a base32 secret!"), /Base32/);
  assert.throws(() => generateTotp("GEZDGNBV", { digits: 5 }), /digits/);
});
