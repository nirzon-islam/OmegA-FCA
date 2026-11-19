"use strict";

const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");
const { encryptSession, decryptSession } = require("./src/security/sessionCrypto");
const { saveSession, loadSession, deleteSession } = require("./src/security/sessionStore");
const { ConnectionSupervisor } = require("./src/runtime/connection");
const { EventDispatcher } = require("./src/events/dispatcher");
const { createClient } = require("./src/api/client");
const { createGoatBotLogin } = require("./src/compat/goatbotLogin");
const { verifyLicenseToken } = require("./src/license/verify");
const { createLicenseProvider } = require("./src/license/provider");

module.exports = {
  normalizeCookies,
  validateSessionCookies,
  parseCookieHeader,
  parseNetscapeCookies,
  redactSecrets,
  encryptSession,
  decryptSession,
  saveSession,
  loadSession,
  deleteSession,
  ConnectionSupervisor,
  EventDispatcher,
  createClient,
  createGoatBotLogin,
  verifyLicenseToken,
  createLicenseProvider,
  version: require("./package.json").version
};
