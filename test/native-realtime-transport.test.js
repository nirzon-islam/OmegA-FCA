"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createNativeRealtimeTransport } = require("../src/transport/nativeRealtimeTransport");

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 0;
    this.sent = [];
    setImmediate(() => { this.readyState = 1; this.emit("open"); });
  }
  send(frame, callback) { this.sent.push(frame); callback?.(); }
  close() { this.readyState = 3; this.emit("close", 1000); }
}

function makeProtocol() {
  return {
    async authenticate(socket) { socket.authenticated = true; },
    async subscribe(socket) { socket.subscribed = true; },
    decodeFrame(frame) { return { events: [{ name: "fixture", args: frame.toString() }] }; },
    encodeAction(action) { return Buffer.from(JSON.stringify(action)); }
  };
}

test("connects, authenticates, subscribes, receives events and sends encoded actions", async () => {
  const socket = new FakeSocket();
  const transport = createNativeRealtimeTransport({
    url: "wss://fixture.invalid/realtime",
    socketFactory: async () => socket,
    protocol: makeProtocol()
  });

  const driver = await transport.connect({ attempt: 0 });
  assert.equal(transport.snapshot().state, "connected");
  assert.equal(socket.authenticated, true);
  assert.equal(socket.subscribed, true);

  let received;
  driver.listen((error, event) => { assert.equal(error, null); received = event; });
  socket.emit("message", Buffer.from("fixture-frame"), true);
  assert.deepEqual(received, { name: "fixture", args: "fixture-frame" });

  await driver.sendAction({ type: "fixture_action" });
  assert.equal(socket.sent.length, 1);
  assert.deepEqual(JSON.parse(socket.sent[0].toString()), { type: "fixture_action" });

  await transport.disconnect();
  assert.equal(transport.snapshot().state, "closed");
});

test("rejects unverified endpoints and incomplete protocol adapters", () => {
  assert.throws(() => createNativeRealtimeTransport({
    url: "wss://fixture.invalid/realtime",
    socketFactory: () => new FakeSocket(),
    protocol: {}
  }), /protocol must implement/);
  assert.throws(() => createNativeRealtimeTransport({
    url: "https://fixture.invalid/realtime",
    socketFactory: () => new FakeSocket(),
    protocol: makeProtocol()
  }), /verified wss/);
});

test("reports unexpected socket closure through the driver listener", async () => {
  const socket = new FakeSocket();
  const transport = createNativeRealtimeTransport({
    url: "wss://fixture.invalid/realtime",
    socketFactory: async () => socket,
    protocol: makeProtocol()
  });
  const driver = await transport.connect();
  let failure;
  driver.listen(error => { failure = error; });
  socket.emit("close", 1006);
  assert.equal(failure.code, "FCA_WS_UNEXPECTED_CLOSE");
  assert.equal(transport.snapshot().state, "disconnected");
  await transport.disconnect();
});
