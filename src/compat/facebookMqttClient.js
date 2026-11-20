"use strict";

const { createClient } = require("../api/client");
const { createFacebookMqttDriver } = require("../transport/facebookMqttDriver");

/**
 * Creates the first-party AppState-only personal Messenger client.
 * The WebSocket implementation is injected by the application (for example,
 * the "ws" package). This does not enable password/2FA login or invent
 * unsupported private Facebook action endpoints.
 */
function createFacebookMqttClient(options = {}) {
  const {
    socketFactory,
    fetchImpl,
    userAgent,
    timeoutMs,
    connectTimeoutMs,
    closeTimeoutMs,
    protocolSetupTimeoutMs,
    maxFrameBytes,
    syncCursorStore,
    onSyncCursor,
    requestTimeoutMs,
    maxPendingRequests,
    mqtt,
    onDiagnostic,
    reconnect,
    license,
    requireLicense,
    onLicenseError
  } = options;

  if (typeof socketFactory !== "function") {
    throw new TypeError("socketFactory is required");
  }

  return createClient({
    reconnect,
    license,
    requireLicense,
    onLicenseError,
    authenticate: ({ mode, credentials }) => {
      if (mode !== "appstate") {
        throw new TypeError("Native Messenger client currently supports AppState login only");
      }
      return createFacebookMqttDriver({
        appState: credentials,
        socketFactory,
        fetchImpl,
        userAgent,
        timeoutMs,
        connectTimeoutMs,
        closeTimeoutMs,
        protocolSetupTimeoutMs,
        maxFrameBytes,
        syncCursorStore,
        onSyncCursor,
        requestTimeoutMs,
        maxPendingRequests,
        mqtt,
        onDiagnostic
      });
    }
  });
}

module.exports = { createFacebookMqttClient };
