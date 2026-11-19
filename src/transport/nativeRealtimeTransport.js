"use strict";

const { EventEmitter } = require("node:events");
const { decodeRealtimeFrame, DEFAULT_MAX_FRAME_BYTES } = require("./realtimeFrameDecoder");

const DEFAULT_CONNECT_TIMEOUT_MS = 15000;
const DEFAULT_CLOSE_TIMEOUT_MS = 3000;

function transportError(message, code, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

function attach(socket, event, handler) {
  if (typeof socket.on === "function") {
    socket.on(event, handler);
    return () => {
      if (typeof socket.off === "function") socket.off(event, handler);
      else if (typeof socket.removeListener === "function") socket.removeListener(event, handler);
    };
  }
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(event, handler);
    return () => socket.removeEventListener?.(event, handler);
  }
  throw new TypeError("WebSocket implementation must support on() or addEventListener()");
}

function asBytes(data) {
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

/**
 * Creates the protocol-neutral native WebSocket runtime.
 *
 * The Facebook-specific handshake, subscription, frame encoding and action
 * schemas must be supplied by a separately verified protocol adapter. This
 * module deliberately contains no guessed Facebook endpoint or wire fields.
 */
function createNativeRealtimeTransport(options = {}) {
  const {
    url,
    socketFactory,
    protocol,
    protocols,
    headers,
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
    closeTimeoutMs = DEFAULT_CLOSE_TIMEOUT_MS,
    maxFrameBytes = DEFAULT_MAX_FRAME_BYTES,
    onDiagnostic
  } = options;

  if (typeof url !== "string" || !/^wss:\/\//i.test(url)) {
    throw new TypeError("A verified wss:// URL is required");
  }
  if (typeof socketFactory !== "function") throw new TypeError("socketFactory is required");
  if (!protocol || typeof protocol !== "object" ||
      typeof protocol.authenticate !== "function" ||
      typeof protocol.subscribe !== "function" ||
      typeof protocol.decodeFrame !== "function" ||
      typeof protocol.encodeAction !== "function") {
    throw new TypeError("protocol must implement authenticate, subscribe, decodeFrame and encodeAction");
  }
  for (const [name, value] of [["connectTimeoutMs", connectTimeoutMs], ["closeTimeoutMs", closeTimeoutMs]]) {
    if (!Number.isInteger(value) || value < 1 || value > 120000) throw new TypeError(name + " must be between 1 and 120000");
  }
  if (!Number.isInteger(maxFrameBytes) || maxFrameBytes < 1 || maxFrameBytes > 16 * 1024 * 1024) {
    throw new TypeError("maxFrameBytes must be between 1 and 16777216");
  }

  const emitter = new EventEmitter();
  let socket = null;
  let state = "idle";
  let listener = null;
  let detach = [];
  let connectPromise = null;
  let disconnectPromise = null;
  let terminalError = null;
  let generation = 0;

  const diagnostic = (phase, extra = {}) => {
    if (typeof onDiagnostic !== "function") return;
    try { onDiagnostic(Object.freeze({ phase, state, at: new Date().toISOString(), ...extra })); } catch {}
  };

  function cleanupListeners() {
    for (const remove of detach.splice(0)) {
      try { remove(); } catch {}
    }
  }

  function notifyFailure(error) {
    if (terminalError) return;
    terminalError = error instanceof Error ? error : new Error(String(error));
    state = "disconnected";
    diagnostic("socket_error", { code: terminalError.code || null });
    emitter.emit("transportError", terminalError);
    if (listener) {
      const callback = listener;
      listener = null;
      try { callback(terminalError); } catch {}
    }
  }

  async function connect(context = {}) {
    if (state === "connected") return driver;
    if (connectPromise) return connectPromise;
    if (disconnectPromise) await disconnectPromise;
    const currentGeneration = ++generation;
    state = "connecting";
    terminalError = null;
    diagnostic("connecting");

    connectPromise = (async () => {
      const signal = context.signal;
      if (signal?.aborted) throw signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED");
      let candidate;
      try {
        candidate = await socketFactory({ url, protocols, headers, signal });
      } catch {
        throw transportError("WebSocket creation failed", "FCA_WS_CREATE_FAILED", true);
      }
      if (!candidate || typeof candidate.send !== "function") {
        throw transportError("socketFactory returned an invalid WebSocket", "FCA_WS_INVALID_SOCKET");
      }
      socket = candidate;

      await new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        let abortHandler = null;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
          removeOpen();
          removeError();
          removeClose();
          if (error) reject(error);
          else resolve();
        };
        const removeOpen = attach(candidate, "open", () => finish());
        const removeError = attach(candidate, "error", () => finish(transportError("WebSocket connection failed", "FCA_WS_CONNECT_FAILED", true)));
        const removeClose = attach(candidate, "close", () => finish(transportError("WebSocket closed before opening", "FCA_WS_CLOSED_EARLY", true)));
        timer = setTimeout(() => finish(transportError("WebSocket connection timed out", "FCA_WS_CONNECT_TIMEOUT", true)), connectTimeoutMs);
        if (signal) {
          abortHandler = () => finish(signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED"));
          signal.addEventListener("abort", abortHandler, { once: true });
          if (signal.aborted) abortHandler();
        }
        if (candidate.readyState === 1) finish();
      });

      if (currentGeneration !== generation) throw transportError("Connection superseded", "FCA_WS_SUPERSEDED");
      const contextWithSignal = { ...context, url };
      try {
        await protocol.authenticate(candidate, contextWithSignal);
        await protocol.subscribe(candidate, contextWithSignal);
      } catch {
        throw transportError("Protocol authentication or subscription failed", "FCA_WS_PROTOCOL_SETUP_FAILED", false);
      }
      if (currentGeneration !== generation) throw transportError("Connection superseded", "FCA_WS_SUPERSEDED");

      detach.push(attach(candidate, "message", (message, isBinary) => {
        if (currentGeneration !== generation || state !== "connected") return;
        const raw = message?.data !== undefined ? message.data : message;
        const bytes = asBytes(raw);
        if (bytes && bytes.byteLength > maxFrameBytes) {
          notifyFailure(transportError("Incoming frame exceeds configured size limit", "FCA_WS_FRAME_TOO_LARGE"));
          return;
        }
        try {
          const decoded = protocol.decodeFrame(raw, { isBinary: Boolean(isBinary), maxFrameBytes });
          const events = Array.isArray(decoded) ? decoded : decoded?.events;
          if (!Array.isArray(events)) throw transportError("Protocol decoder returned no events array", "FCA_WS_DECODE_CONTRACT");
          for (const event of events) {
            if (listener) {
              try { listener(null, event); } catch (error) { emitter.emit("listenerError", error); }
            }
            emitter.emit("event", event);
          }
        } catch {
          diagnostic("frame_rejected");
          emitter.emit("frameRejected", Object.freeze({ byteLength: bytes?.byteLength ?? null }));
        }
      }));
      detach.push(attach(candidate, "error", () => notifyFailure(
        transportError("WebSocket transport error", "FCA_WS_RUNTIME_ERROR", true)
      )));
      detach.push(attach(candidate, "close", (code) => {
        if (currentGeneration === generation && state !== "closing" && state !== "closed") {
          notifyFailure(transportError("WebSocket closed unexpectedly", "FCA_WS_UNEXPECTED_CLOSE", true));
        }
        diagnostic("closed", { closeCode: Number.isInteger(code) ? code : null });
      }));

      state = "connected";
      diagnostic("connected");
      emitter.emit("connected", snapshot());
      return driver;
    })().catch(async error => {
      if (socket) {
        const failed = socket;
        socket = null;
        try { failed.close?.(); } catch {}
      }
      cleanupListeners();
      state = "disconnected";
      diagnostic("connect_failed", { code: error.code || null });
      throw error;
    }).finally(() => { connectPromise = null; });
    return connectPromise;
  }

  function snapshot() {
    return Object.freeze({ state, connected: state === "connected", generation });
  }

  const driver = Object.freeze({
    listen(callback) {
      if (typeof callback !== "function") throw new TypeError("listener callback is required");
      if (state !== "connected") throw transportError("WebSocket is not connected", "FCA_WS_NOT_CONNECTED");
      if (listener) throw transportError("A listener is already attached", "FCA_WS_LISTENER_EXISTS");
      listener = callback;
      return () => { if (listener === callback) listener = null; };
    },
    async sendAction(action) {
      if (state !== "connected" || !socket) throw transportError("WebSocket is not connected", "FCA_WS_NOT_CONNECTED", true);
      let frame;
      try { frame = await protocol.encodeAction(action); }
      catch { throw transportError("Protocol action encoding failed", "FCA_WS_ACTION_ENCODE_FAILED"); }
      if (!(typeof frame === "string" || Buffer.isBuffer(frame) || frame instanceof Uint8Array || frame instanceof ArrayBuffer)) {
        throw transportError("Protocol encoder returned an unsupported frame", "FCA_WS_ACTION_FRAME_INVALID");
      }
      if (frame.byteLength > maxFrameBytes) throw transportError("Outgoing frame exceeds configured size limit", "FCA_WS_FRAME_TOO_LARGE");
      await new Promise((resolve, reject) => {
        try {
          if (socket.send.length >= 2) socket.send(frame, error => error ? reject(error) : resolve());
          else { socket.send(frame); resolve(); }
        } catch { reject(transportError("WebSocket send failed", "FCA_WS_SEND_FAILED", true)); }
      });
      return Object.freeze({ sent: true });
    },
    async disconnect() {
      if (disconnectPromise) return disconnectPromise;
      ++generation;
      state = "closing";
      listener = null;
      cleanupListeners();
      const current = socket;
      socket = null;
      disconnectPromise = (async () => {
        if (current && typeof current.close === "function") {
          await new Promise(resolve => {
            let done = false;
            const finish = () => { if (done) return; done = true; clearTimeout(timer); removeClose(); resolve(); };
            const removeClose = attach(current, "close", finish);
            const timer = setTimeout(finish, closeTimeoutMs);
            try { current.close(); } catch { finish(); }
            if (current.readyState === 3) finish();
          });
        }
        state = "closed";
        diagnostic("disconnected");
        emitter.emit("disconnected", snapshot());
      })().finally(() => { disconnectPromise = null; });
      return disconnectPromise;
    },
    getConnectionState: snapshot
  });

  return Object.freeze({
    connect,
    disconnect: () => driver.disconnect(),
    getDriver: () => driver,
    snapshot,
    on: (event, callback) => { emitter.on(event, callback); return () => emitter.off(event, callback); }
  });
}

module.exports = { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_CLOSE_TIMEOUT_MS, createNativeRealtimeTransport };
