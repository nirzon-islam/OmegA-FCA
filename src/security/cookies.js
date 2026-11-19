"use strict";

const MAX_COOKIE_COUNT = 500;
const MAX_COOKIE_VALUE_LENGTH = 16_000;
const FACEBOOK_DOMAINS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "messenger.com"]);

function normalizeDomain(domain) {
  if (typeof domain !== "string" || !domain.trim()) throw new TypeError("Cookie domain is required");
  const value = domain.trim().toLowerCase().replace(/^\./, "");
  if (!FACEBOOK_DOMAINS.has(value) && !value.endsWith(".facebook.com")) {
    throw new TypeError("Only Facebook/Messenger cookie domains are accepted");
  }
  return value;
}

function normalizeCookies(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_COOKIE_COUNT) {
    throw new TypeError("Cookies must be a non-empty array (maximum 500 entries)");
  }
  const seen = new Set();
  const result = input.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("Invalid cookie entry");
    const key = typeof item.key === "string" ? item.key : item.name;
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(key)) throw new TypeError("Invalid cookie name");
    if (typeof item.value !== "string" || !item.value || item.value.length > MAX_COOKIE_VALUE_LENGTH) throw new TypeError("Invalid cookie value");
    const domain = normalizeDomain(item.domain || "facebook.com");
    const path = item.path === undefined ? "/" : item.path;
    if (typeof path !== "string" || !path.startsWith("/") || path.length > 1024) throw new TypeError("Invalid cookie path");
    const identity = [domain, path, key].join("\n");
    if (seen.has(identity)) throw new TypeError("Duplicate cookie entry");
    seen.add(identity);
    return {
      key,
      value: item.value,
      domain,
      path,
      hostOnly: Boolean(item.hostOnly),
      ...(item.expires ? { expires: item.expires } : {})
    };
  });
  return result;
}

function validateSessionCookies(input) {
  const cookies = normalizeCookies(input);
  const values = new Map(cookies.map(cookie => [cookie.key, cookie.value]));
  if (!/^\d{5,30}$/.test(values.get("c_user") || "") || !values.get("xs")) {
    throw new TypeError("Facebook session requires valid c_user and xs cookies");
  }
  return cookies;
}

function parseCookieHeader(header) {
  if (typeof header !== "string" || !header.trim() || header.length > 64 * 1024) {
    throw new TypeError("Cookie header must be non-empty text up to 64 KiB");
  }
  const entries = header.split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf("=");
    if (index <= 0) throw new TypeError("Malformed cookie header");
    return { key: part.slice(0, index).trim(), value: part.slice(index + 1).trim(), domain: "facebook.com", path: "/" };
  });
  return normalizeCookies(entries);
}

function parseNetscapeCookies(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 256 * 1024) throw new TypeError("Netscape cookie file must be non-empty text up to 256 KiB");
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const fields = line.split("\t");
    if (fields.length < 7) throw new TypeError("Malformed Netscape cookie row");
    const [domain, includeSubdomains, path, secure, expires, key, ...valueParts] = fields;
    rows.push({ key, value: valueParts.join("\t"), domain, path, hostOnly: includeSubdomains.toUpperCase() !== "TRUE", secure: secure.toUpperCase() === "TRUE", expires: Number(expires) || null });
  }
  return normalizeCookies(rows);
}

module.exports = { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies };
