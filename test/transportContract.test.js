"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTransportDriver, createTransportFactory } = require("../src/transport/contract");

test("accepts a driver with the required listener method", () => {
  const driver = { listen() {}, sendMessage() {} };
  assert.equal(validateTransportDriver(driver), driver);
});

test("rejects missing or malformed driver methods without retrying", () => {
  assert.throws(() => validateTransportDriver({}), error => error.code === "FCA_TRANSPORT_CONTRACT_INVALID" && error.retryable === false);
  assert.throws(() => validateTransportDriver({ listen() {}, sendMessage: true }), /must be a function/);
});

test("wraps an injected provider and validates its result", async () => {
  const factory = createTransportFactory(async context => {
    assert.equal(context.mode, "appstate");
    return { listen() {} };
  });
  assert.equal(typeof (await factory({ mode: "appstate" })).listen, "function");
  await assert.rejects(createTransportFactory(async () => null)({}), /driver object/);
});
