"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createFacebookMqttClient } = require("../src/compat/facebookMqttClient");
const mqtt = require("../transport/mqtt311Codec");

const appState = [
  { key: "c_user", value: "123456789012345", domain: ".facebook.com", path: "/", secure: true, httpOnly: true },
  { key: "xs", value: "synthetic-session", domain: ".facebook.com", path: "/", secure: true, httpOnly: true }
];

function response() {
  const html = '<html><script>{"USER_ID":"123456789012345"}</script></html>';
  return {
    status: 200, ok: true,
    headers: {
      get: name => name.toLowerCase() === "content-length" ? String(Buffer.byteLength(html)) :
        name.toLowerCase() === "content-type" ? "text/html" : null,
      getSetCookie: () => []
    },
    text: async () => html
  };
}

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 0;
    setImmediate(() => { this.readyState = 1; this.emit("open"); });
  }
  send(frame) {
    const bytes = Buffer.from(frame);
    const type = bytes[0] >> 4;
    if (type === 1) setImmediate(() => this.emit("message", Buffer.from([0x20, 0x02, 0, 0])));
    if (type === 8) {
      const remaining = mqtt.decodeRemainingLength(bytes);
      const id = bytes.readUInt16BE(remaining.offset);
      setImmediate(() => this.emit("message", Buffer.from([0x90, 0x03, id >> 8, id & 255, 1])));
    }
  }
  close() {
    this.readyState = 3;
    setImmediate(() => this.emit("close", 1000));
  }
}

test("first-party client logs in with AppState and exposes callback-compatible MQTT lifecycle", async () => {
  const client = createFacebookMqttClient({
    socketFactory: () => new FakeSocket(),
    fetchImpl: async () => response(),
    mqtt: { keepAlive: 0 }
  });
  const api = await client.login({ mode: "appstate", appState });
  assert.equal(api.getCurrentUserID(), "123456789012345");
  assert.equal(typeof api.listenMqtt, "function");
  assert.equal(typeof api.sendMessage, "function");
  assert.equal(api.getThreadInfo, undefined);
  await client.logout();
});

test("first-party client requires an injected WebSocket implementation", () => {
  assert.throws(() => createFacebookMqttClient(), /socketFactory is required/);
});
