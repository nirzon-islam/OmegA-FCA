"use strict";

const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");
const { ConnectionSupervisor } = require("./src/runtime/connection");
const { createClient } = require("./src/api/client");

module.exports = {
  normalizeCookies,
  validateSessionCookies,
  parseCookieHeader,
  parseNetscapeCookies,
  redactSecrets,
  ConnectionSupervisor,
  createClient,
  version: require("./package.json").version
};
