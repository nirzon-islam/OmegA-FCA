"use strict";

const { createPersonalSession } = require("../auth/personalSession");
const { createFacebookMqttProtocol } = require("./facebookMqttProtocol");
const { createNativeRealtimeTransport } = require("./nativeRealtimeTransport");

/**
 * Builds an owner-authorized personal Messenger MQTT driver.
 * The caller supplies a WebSocket implementation; no browser automation,
 * checkpoint bypass, password login, or hidden credential collection occurs.
 */
async function createFacebookMqttDriver({
  appState,
  socketFactory,
  fetchImpl,
  userAgent,
  timeoutMs = 20000,
  connectTimeoutMs = 15000,
  closeTimeoutMs = 3000,
  protocolSetupTimeoutMs = 15000,
  maxFrameBytes,
  syncCursorStore,
  onSyncCursor,
  requestTimeoutMs,
  maxPendingRequests,
  mqtt = {},
  onDiagnostic
} = {}) {
  if (typeof socketFactory !== "function") throw new TypeError("socketFactory is required");
  const session = await createPersonalSession({ appState, fetchImpl, userAgent, timeoutMs, onDiagnostic });
  let closed = false;
  let transport;
  try {
    const protocolConfig = createFacebookMqttProtocol({
      ...mqtt,
      userId: session.userId,
      cookie: session.getCookieHeader("https://edge-chat.facebook.com/chat"),
      userAgent,
      syncCursorStore,
      onSyncCursor,
      requestTimeoutMs,
      maxPendingRequests
    });
    transport = createNativeRealtimeTransport({
      url: protocolConfig.url,
      headers: protocolConfig.headers,
      socketFactory,
      protocol: protocolConfig.protocol,
      connectTimeoutMs,
      closeTimeoutMs,
      protocolSetupTimeoutMs,
      ...(maxFrameBytes === undefined ? {} : { maxFrameBytes }),
      onDiagnostic
    });
    await transport.connect();
    const driver = transport.getDriver();
    return Object.freeze({
      ...driver,
      getCurrentUserID: () => session.userId,
      getSessionState: () => session.state,
      disconnect: async () => {
        if (closed) return;
        closed = true;
        try { await transport.disconnect(); }
        finally { session.close(); }
      }
    });
  } catch (error) {
    try { if (transport) await transport.disconnect(); } catch {}
    session.close();
    throw error;
  }
}

module.exports = { createFacebookMqttDriver };
