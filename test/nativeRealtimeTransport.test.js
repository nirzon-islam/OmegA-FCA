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
    this.closeCalls = 0;
  }

  open() {
    this.readyState = 1;
    this.emit("open");
  }

  send(frame, callback) {
    this.sent.push(frame);
    if (typeof callback === "function") callback(null);
  }

  close() {
    this.closeCalls += 1;
    this.readyState = 3;
    this.emit("close", 1000);
  }

  receive(frame, isBinary = true) {
    this.emit("message", frame, isBinary);
  }
}

function setup(overrides = {}) {
  const socket = new FakeSocket();
  const calls = [];
  const protocol = {
    async authenticate(candidate, context) {
      calls.push(["authenticate", candidate, context.url]);
    },
    async subscribe(candidate) {
      calls.push(["subscribe", candidate]);
    },
    decodeFrame(frame, metadata) {
      calls.push(["decodeFrame", frame, metadata.isBinary]);
      return { events: [{ type: "message", frame }] };
    },
    async encodeAction(action) {
      return Buffer.from(JSON.stringify(action));
    },
    ...overrides.protocol
  };
  const transport = createNativeRealtimeTransport({
    url: "wss://example.invalid/socket",
    socketFactory: async () => {
      queueMicrotask(() => socket.open());
      return socket;
    },
    protocol,
    ...overrides.options
  });
  return { transport, socket, calls };
}

test("connects, authenticates and subscribes before reporting ready", async () => {
  const { transport, socket, calls } = setup();
  let connected = false;
  transport.on("connected", snapshot => {
    connected = snapshot.connected;
  });

  const driver = await transport.connect({ owner: "test" });

  assert.equal(connected, true);
  assert.deepEqual(calls.map(call => call[0]), ["authenticate", "subscribe"]);
  assert.equal(driver.getConnectionState().state, "connected");
  assert.equal(socket.closeCalls, 0);
  await transport.disconnect();
  assert.equal(socket.closeCalls, 1);
  assert.equal(transport.snapshot().state, "closed");
});

test("decodes incoming events and sends bounded encoded actions", async () => {
  const { transport, socket } = setup();
  const driver = await transport.connect();
  const received = [];
  driver.listen((error, event) => received.push({ error, event }));

  socket.receive(Buffer.from([1, 2, 3]));
  assert.equal(received.length, 1);
  assert.equal(received[0].error, null);
  assert.equal(received[0].event.type, "message");

  const result = await driver.sendAction({ body: "hello" });
  assert.equal(result.sent, true);
  assert.deepEqual(JSON.parse(socket.sent[0].toString()), { body: "hello" });
  await transport.disconnect();
});

test("rejects oversized incoming frames and emits a transport error", async () => {
  const { transport, socket } = setup({ options: { maxFrameBytes: 2 } });
  const driver = await transport.connect();
  const errors = [];
  transport.on("transportError", error => errors.push(error));

  socket.receive(Buffer.from([1, 2, 3]));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "FCA_WS_FRAME_TOO_LARGE");
  assert.equal(driver.getConnectionState().state, "disconnected");
  await transport.disconnect();
});

test("rejects malformed protocol adapters and insecure URLs", () => {
  assert.throws(() => createNativeRealtimeTransport({
    url: "ws://example.invalid",
    socketFactory() {},
    protocol: {}
  }), /verified wss/);

  assert.throws(() => createNativeRealtimeTransport({
    url: "wss://example.invalid",
    socketFactory() {},
    protocol: {}
  }), /protocol must implement/);
});

test("does not expose decoder exceptions as event data", async () => {
  const { transport, socket } = setup({
    protocol: {
      decodeFrame() {
        throw new Error("private parser detail");
      }
    }
  });
  const rejected = [];
  const driver = await transport.connect();
  transport.on("frameRejected", detail => rejected.push(detail));

  socket.receive(Buffer.from([9, 8]));
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].byteLength, 2);
  await transport.disconnect();
});
