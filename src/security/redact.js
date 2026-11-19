"use strict";

const SECRET_KEYS = /^(?:cookie|cookies|appstate|app_state|password|pass|xs|token|access_token|authorization|secret|2fasecret)$/i;

function redactSecrets(value, key = "") {
  if (SECRET_KEYS.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map(item => redactSecrets(item));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = redactSecrets(childValue, childKey);
  }
  return output;
}

module.exports = { redactSecrets };
