"use strict";

const { normalizeCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");

module.exports = {
  normalizeCookies,
  parseCookieHeader,
  parseNetscapeCookies,
  redactSecrets,
  version: require("./package.json").version
};
