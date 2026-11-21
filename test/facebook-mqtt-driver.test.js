"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createFacebookMqttClient } = require("../src/compat/facebookMqttClient");
const { createFacebookMqttDriver } = require("../src/transport/facebookMqttDriver");
const mqtt = require("../src/transport/mqtt311Codec");

const appState = [
  { key: "c_user", value: "123456789012345", domain: ".facebook.com", path: "/", secure: true, httpOnly: true },
  { key: "xs", value: "session-token", domain: ".facebook.com", path: "/", secure: true, httpOnly: true }
];

function htmlResponse() {
  const html = '<html><script>{"USER_ID":"123456789012345"}</script></html>';
  return {
    status: 200, ok: true,
    headers: { get: name => name.toLowerCase() === "content-length" ? String(Buffer.byteLength(html)) : name.toLowerCase() === "content-type" ? "text/html" : null, getSetCookie: () => [] },
    text: async () => html
  };
}

class FakeWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 0;
    setImmediate(() => { this.readyState = 1; this.emit("open"); });
  }
  send(frame) {
    const bytes = Buffer.from(frame);
    const type = bytes[0] >> 4;
    if (type === 1) setImmediate(() => this.emit("message", Buffer.from([0x20, 0x02, 0x00, 0x00])));
    if (type === 8) {
      const remaining = mqtt.decodeRemainingLength(bytes);
      const packetId = bytes.readUInt16BE(remaining.offset);
      setImmediate(() => this.emit("message", Buffer.from([0x90, 0x03, packetId >> 8, packetId & 0xff, 0x01])));
    }
  }
  close() {
    this.readyState = 3;
    setImmediate(() => this.emit("close", 1000));
  }
}

test("integrated driver validates AppState, authenticates MQTT and exposes an FCA driver", async () => {
  const driver = await createFacebookMqttDriver({
    appState,
    fetchImpl: async () => htmlResponse(),
    socketFactory: () => new FakeWebSocket(),
    mqtt: { keepAlive: 0 }
  });
  assert.equal(driver.getCurrentUserID(), "123456789012345");
  assert.equal(driver.getSessionState(), "active");
  assert.deepEqual(driver.getAppState().map(({ key, value }) => ({ key, value })), appState.map(({ key, value }) => ({ key, value })));
  assert.equal(typeof driver.listen, "function");
  assert.equal(typeof driver.sendMessage, "function");
  await driver.disconnect();
});

test("integrated driver requires an injected WebSocket implementation", async () => {
  await assert.rejects(createFacebookMqttDriver({ appState }), /socketFactory is required/);
});

test("native driver automatically snapshots AppState when SessionGuard is configured", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-driver-guard-"));
  const filePath = path.join(directory, "session.enc");
  const key = "a".repeat(64);
  let driver;
  try {
    driver = await createFacebookMqttDriver({
      appState, fetchImpl: async () => htmlResponse(),
      socketFactory: () => new FakeWebSocket(), mqtt: { keepAlive: 0 },
      sessionGuard: { filePath, key, intervalMs: 60_000 }
    });
    assert.equal(driver.sessionGuard().filePath, filePath);
    const saved = require("../src/security/sessionStore").loadSession(filePath, key);
    assert.equal(saved.userId, "123456789012345");
    assert.deepEqual(saved.appState.map(({ key, value }) => ({ key, value })), appState.map(({ key, value }) => ({ key, value })));
    assert.equal(await driver.stopSessionGuard(), true);
    assert.throws(() => driver.sessionGuard(), /SessionGuard is not configured/);
  } finally {
    if (driver) await driver.disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy GoatBot account.txt SessionGuard call never writes encrypted data into account.txt", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-driver-legacy-guard-"));
  const accountPath = path.join(directory, "account.txt");
  const encryptedPath = path.join(directory, "private", "facebook-session.enc");
  const originalAccount = JSON.stringify(appState);
  fs.writeFileSync(accountPath, originalAccount, "utf8");
  let driver;
  try {
    driver = await createFacebookMqttDriver({
      appState, fetchImpl: async () => htmlResponse(),
      socketFactory: () => new FakeWebSocket(), mqtt: { keepAlive: 0 },
      sessionGuard: { filePath: encryptedPath, key: "b".repeat(64), intervalMs: 60_000 }
    });
    const configured = driver.sessionGuard(accountPath, { interval: 180_000, debounce: 30_000 });
    assert.equal(configured.filePath, encryptedPath);
    assert.equal(fs.readFileSync(accountPath, "utf8"), originalAccount);
    assert.notEqual(fs.readFileSync(encryptedPath, "utf8"), originalAccount);
  } finally {
    if (driver) await driver.disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("deployment environment enables GoatBot-compatible encrypted SessionGuard", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-driver-env-guard-"));
  const accountPath = path.join(directory, "account.txt");
  const encryptedPath = path.join(directory, "private", "session.enc");
  const originalAccount = JSON.stringify(appState);
  fs.writeFileSync(accountPath, originalAccount, "utf8");
  const previous = { file: process.env.FCA_SESSION_FILE, key: process.env.FCA_SESSION_KEY, interval: process.env.FCA_SESSION_INTERVAL_MS };
  let client;
  try {
    process.env.FCA_SESSION_FILE = encryptedPath;
    process.env.FCA_SESSION_KEY = "c".repeat(64);
    process.env.FCA_SESSION_INTERVAL_MS = "180000";
    client = createFacebookMqttClient({
      socketFactory: () => new FakeWebSocket(),
      fetchImpl: async () => htmlResponse(), mqtt: { keepAlive: 0 }
    });
    const api = await client.login({ mode: "appstate", appState });
    assert.equal(typeof api.httpPost, "function");
    assert.equal(typeof api.getAppState, "function");
    for (const method of ["unsendMessage", "setTitle", "changeThreadColor", "changeThreadEmoji", "sendTypingIndicator", "markAsDelivered", "refreshFb_dtsg"]) assert.equal(typeof api[method], "function", method);
    assert.equal(api.sessionGuard(accountPath, { interval: 180_000, debounce: 30_000 }).filePath, encryptedPath);
    assert.equal(fs.existsSync(encryptedPath), true);
    assert.equal(fs.readFileSync(accountPath, "utf8"), originalAccount);
    await client.logout();
  } finally {
    if (client) await client.logout().catch(() => {});
    if (previous.file === undefined) delete process.env.FCA_SESSION_FILE; else process.env.FCA_SESSION_FILE = previous.file;
    if (previous.key === undefined) delete process.env.FCA_SESSION_KEY; else process.env.FCA_SESSION_KEY = previous.key;
    if (previous.interval === undefined) delete process.env.FCA_SESSION_INTERVAL_MS; else process.env.FCA_SESSION_INTERVAL_MS = previous.interval;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("native driver rejects SessionGuard without an explicit encryption key", async () => {
  await assert.rejects(createFacebookMqttDriver({
    appState, fetchImpl: async () => htmlResponse(),
    socketFactory: () => new FakeWebSocket(), mqtt: { keepAlive: 0 },
    sessionGuard: { filePath: "/tmp/omega-session.enc" }
  }), error => error.message.includes("explicit 32-byte/64-hex encryption key"));
});

test("native driver rejects encrypted snapshot belonging to a different Facebook account", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-driver-identity-"));
  const filePath = path.join(directory, "session.enc");
  const key = "9".repeat(64);
  require("../src/security/sessionStore").saveSession(filePath, {
    version: 1, userId: "999999999999999", appState, savedAt: Date.now()
  }, key);
  try {
    await assert.rejects(createFacebookMqttDriver({
      fetchImpl: async () => htmlResponse(), socketFactory: () => new FakeWebSocket(),
      mqtt: { keepAlive: 0 }, sessionGuard: { filePath, key }
    }), error => error.code === "FCA_SESSION_IDENTITY_MISMATCH");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("first-party client restores and reconnects using encrypted SessionGuard state", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-client-restore-"));
  const sessionGuard = { filePath: path.join(directory, "account.enc"), key: "d".repeat(64), intervalMs: 60_000 };
  const createClient = () => createFacebookMqttClient({
    socketFactory: () => new FakeWebSocket(), fetchImpl: async () => htmlResponse(),
    mqtt: { keepAlive: 0 }, sessionGuard
  });
  try {
    const first = createClient();
    const firstApi = await first.login({ mode: "appstate", appState });
    assert.equal(firstApi.getCurrentUserID(), "123456789012345");
    await first.logout();
    const second = createClient();
    const restoredApi = await second.login({ mode: "session" });
    assert.equal(restoredApi.getCurrentUserID(), "123456789012345");
    await second.logout();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("SessionGuard refuses to use the GoatBot account.txt path for encrypted output", async () => {
  await assert.rejects(createFacebookMqttDriver({
    appState,
    socketFactory: () => new FakeWebSocket(),
    sessionGuard: { filePath: path.resolve(process.cwd(), "account.txt"), key: "e".repeat(64) }
  }), /separate from GoatBot account.txt/);
});

test("SessionGuard rejects malformed encryption keys before network setup", async () => {
  await assert.rejects(createFacebookMqttDriver({
    appState,
    socketFactory: () => new FakeWebSocket(),
    sessionGuard: { filePath: path.join(os.tmpdir(), "omega-invalid-key.enc"), key: "not-a-key" }
  }), /32 bytes or exactly 64 hexadecimal/);
});


test("honors GoatBot listener options and filters self, event, typing and presence deltas", async () => {
  const socket = new FakeWebSocket();
  const driver = await createFacebookMqttDriver({
    appState, fetchImpl: async () => htmlResponse(), socketFactory: () => socket,
    mqtt: { keepAlive: 0 },
    options: {
      selfListen: false, selfListenEvent: true, listenEvents: true,
      listenTyping: true, updatePresence: true
    }
  });
  const received = [];
  const detach = driver.listen((error, event) => {
    if (error) throw error;
    received.push(event);
  });
  const threadID = "987654321";
  const delta = (kind, senderID, messageID) => ({
    class: kind,
    messageMetadata: {
      threadKey: { threadFbId: threadID },
      messageId: messageID,
      actorFbId: senderID
    },
    body: "synthetic"
  });
  socket.emit("message", mqtt.encodePublish({
    topic: "/t_ms",
    payload: JSON.stringify({ deltas: [
      delta("NewMessage", "123456789012345", "self-message"),
      delta("NewMessage", "111111111111111", "other-message"),
      delta("ThreadEvent", "123456789012345", "self-event"),
      delta("ThreadEvent", "111111111111111", "other-event"),
      delta("TypingNotification", "111111111111111", "typing-event"),
      delta("PresenceUpdate", "111111111111111", "presence-event")
    ] }),
    qos: 1, packetId: 9
  }));
  assert.deepEqual(received.map(event => event.type), ["message", "event", "event", "typ", "presence"]);
  assert.equal(received[0].messageID, "other-message");
  assert.equal(received[1].senderID, "123456789012345");
  assert.equal(received[2].senderID, "111111111111111");

  driver.setOptions({ listenTyping: false, updatePresence: false });
  socket.emit("message", mqtt.encodePublish({
    topic: "/t_ms",
    payload: JSON.stringify({ deltas: [
      delta("TypingNotification", "111111111111111", "typing-disabled"),
      delta("PresenceUpdate", "111111111111111", "presence-disabled")
    ] }),
    qos: 1, packetId: 10
  }));
  assert.equal(received.length, 5);
  assert.throws(() => driver.setOptions({ proxy: "http://127.0.0.1:8080" }), error => error.code === "FCA_OPTION_UNSUPPORTED");
  detach();
  await driver.disconnect();
});
