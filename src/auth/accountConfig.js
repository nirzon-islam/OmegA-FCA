"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseAccountText(text) {
  if (typeof text !== "string") throw new TypeError("account.txt content must be text");
  const values = Object.create(null);
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Invalid account.txt entry on line " + (index + 1));
    const key = line.slice(0, separator).trim().toLowerCase();
    let value = line.slice(separator + 1).trim();
    if (!/^(fb_email|fb_username|fb_password|fb_2fa_code|appstate_file)$/.test(key)) {
      throw new Error("Unsupported account.txt key on line " + (index + 1) + ": " + key);
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (Object.hasOwn(values, key)) throw new Error("Duplicate account.txt key: " + key);
    values[key] = value;
  }
  return values;
}

function loadAccountConfig({
  cwd = process.cwd(),
  accountFile = "account.txt",
  appStateFile = null,
  env = process.env
} = {}) {
  const root = path.resolve(cwd);
  const accountPath = path.resolve(root, accountFile);
  if (!accountPath.startsWith(root + path.sep)) throw new TypeError("accountFile must be inside the project root");
  let fileValues = Object.create(null);
  try {
    const stat = fs.statSync(accountPath);
    if (!stat.isFile() || stat.size > 16 * 1024) throw new Error("account.txt must be a regular file no larger than 16 KiB");
    fileValues = parseAccountText(fs.readFileSync(accountPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const pick = (envKey, fileKey) => {
    const value = env[envKey] || fileValues[fileKey];
    return typeof value === "string" ? value.trim() : "";
  };
  const username = pick("FB_USERNAME", "fb_username");
  const email = pick("FB_EMAIL", "fb_email");
  const password = pick("FB_PASSWORD", "fb_password");
  const twoFactorCode = pick("FB_2FA_CODE", "fb_2fa_code") || null;
  const statePathValue = appStateFile || fileValues.appstate_file || "appstate.json";

  if (username || email || password) {
    if ((!username && !email) || !password) {
      throw new Error("account.txt credentials require FB_USERNAME or FB_EMAIL and FB_PASSWORD");
    }
    return Object.freeze({
      mode: "credentials",
      ...(username ? { username } : { email }),
      password,
      twoFactorCode
    });
  }

  const statePath = path.resolve(root, statePathValue);
  if (!statePath.startsWith(root + path.sep)) throw new TypeError("AppState file must be inside the project root");
  try {
    const stat = fs.statSync(statePath);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("AppState file must be a regular file no larger than 1 MiB");
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const appState = Array.isArray(parsed) ? parsed : parsed && parsed.appState;
    if (!Array.isArray(appState) || appState.length === 0) throw new Error("AppState file must contain a non-empty cookie array");
    return Object.freeze({ mode: "appstate", appState });
  } catch (error) {
    if (error.code === "ENOENT") {
      const missing = new Error("No Facebook credentials found: configure account.txt or provide root appstate.json");
      missing.code = "FCA_ACCOUNT_CONFIG_MISSING";
      throw missing;
    }
    throw error;
  }
}

module.exports = { parseAccountText, loadAccountConfig };
