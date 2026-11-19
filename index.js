"use strict";

const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");
const { ConnectionSupervisor } = require("./src/runtime/connection");
const { createClient } = require("./src/api/client");
const { verifyLicenseToken } = require("./src/license/verify");

module.exports = {
  normalizeCookies,
  validateSessionCookies,
  parseCookieHeader,
  parseNetscapeCookies,
  redactSecrets,
  ConnectionSupervisor,
  createClient,
  verifyLicenseToken,
  version: require("./package.json").version
};
