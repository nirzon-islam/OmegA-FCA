"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifySessionState } = require("../src/security/sessionState");

test("classifies Facebook checkpoints and manual verification states", () => {
  assert.equal(classifySessionState({ error: "checkpoint required" }), "checkpoint");
  assert.equal(classifySessionState("two-factor approval code required"), "checkpoint");
});

test("classifies expired sessions and transient network errors separately", () => {
  assert.equal(classifySessionState({ type: "stop_listen", error: "Not logged in" }), "logged_out");
  assert.equal(classifySessionState(new Error("ECONNRESET")), "error");
  assert.equal(classifySessionState("online"), "online");
  assert.equal(classifySessionState(null), "unknown");
});
