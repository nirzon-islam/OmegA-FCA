"use strict";

const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");
const { classifySessionState, describeError } = require("./src/security/sessionState");
const { encryptSession, decryptSession } = require("./src/security/sessionCrypto");
const { saveSession, loadSession, deleteSession } = require("./src/security/sessionStore");
const { ConnectionSupervisor } = require("./src/runtime/connection");
const { EventDispatcher } = require("./src/events/dispatcher");
const { CookieJar } = require("./src/network/cookieJar");
const { createRequestClient, retryAfterMs, isRetryableStatus } = require("./src/network/requestClient");
const { createClient } = require("./src/api/client");
const { createGoatBotLogin } = require("./src/compat/goatbotLogin");
const { verifyLicenseToken } = require("./src/license/verify");
const { createLicenseProvider } = require("./src/license/provider");
const { validateTransportDriver, createTransportFactory } = require("./src/transport/contract");
const { parseVersion, compareVersions, verifyUpdateManifest, verifyArtifactDigest } = require("./src/update/manifest");

module.exports = {
  normalizeCookies,
  validateSessionCookies,
  parseCookieHeader,
  parseNetscapeCookies,
  redactSecrets,
  classifySessionState,
  describeError,
  encryptSession,
  decryptSession,
  saveSession,
  loadSession,
  deleteSession,
  ConnectionSupervisor,
  EventDispatcher,
  CookieJar,
  createRequestClient,
  retryAfterMs,
  isRetryableStatus,
  createClient,
  createGoatBotLogin,
  verifyLicenseToken,
  createLicenseProvider,
  validateTransportDriver,
  createTransportFactory,
  parseVersion,
  compareVersions,
  verifyUpdateManifest,
  verifyArtifactDigest,
  version: require("./package.json").version
};
