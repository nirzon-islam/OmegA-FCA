"use strict";

const { validateSessionCookies, parseCookieHeader } = require("../security/cookies");
const { ConnectionSupervisor } = require("../runtime/connection");
const { verifyLicenseToken } = require("../license/verify");

const REQUIRED_DRIVER_METHODS = ["sendMessage", "getUserInfo", "getThreadInfo", "getThreadList"];

function createClient({ authenticate, options = {}, reconnect = {}, license = {}, requireLicense = true } = {}) {
  if (typeof authenticate !== "function") throw new TypeError("authenticate transport factory is required");
  let supervisor = null;
  let api = null;
  let userId = null;
  let verifiedLicense = null;

  function checkLicense() {
    if (!requireLicense) return null;
    verifiedLicense = verifyLicenseToken(license.token, license.publicKey, {
      installationId: license.installationId,
      ownerId: license.ownerId
    });
    return verifiedLicense;
  }

  async function login(credentials = {}) {
    if (supervisor && supervisor.snapshot().connected) return api;
    checkLicense();
    const mode = credentials.mode;
    let normalized;
    if (mode === "appstate") {
      normalized = validateSessionCookies(credentials.appState);
    } else if (mode === "cookie") {
      normalized = validateSessionCookies(parseCookieHeader(credentials.cookie));
    } else if (mode === "credentials") {
      if (typeof credentials.email !== "string" || !credentials.email.trim() ||
          typeof credentials.password !== "string" || !credentials.password) {
        throw new TypeError("Email and password are required for credentials login");
      }
      normalized = { email: credentials.email.trim(), password: credentials.password };
    } else {
      throw new TypeError("Login mode must be appstate, cookie, or credentials");
    }

    supervisor = new ConnectionSupervisor({
      connect: async context => {
        const result = await authenticate({ mode, credentials: normalized, options, context, license: verifiedLicense });
        if (!result || typeof result !== "object") throw new Error("Authentication returned no transport");
        return result;
      },
      disconnect: async driver => {
        if (typeof driver.disconnect === "function") await driver.disconnect();
      },
      options: reconnect
    });
    const driver = await supervisor.start();
    if (!driver) throw new Error("Connection stopped before authentication completed");
    userId = typeof driver.getCurrentUserID === "function" ? String(driver.getCurrentUserID()) : null;
    const facade = {};
    for (const method of REQUIRED_DRIVER_METHODS) {
      if (typeof driver[method] === "function") facade[method] = driver[method].bind(driver);
    }
    facade.getCurrentUserID = () => userId;
    facade.listen = callback => supervisor.listen(callback);
    facade.stopListening = () => supervisor.stop();
    facade.getConnectionState = () => supervisor.snapshot();
    facade.getLicense = () => verifiedLicense;
    api = Object.freeze(facade);
    return api;
  }

  return Object.freeze({
    login,
    async logout() {
      if (supervisor) await supervisor.stop();
      supervisor = null;
      api = null;
      userId = null;
    },
    getConnectionState: () => supervisor ? supervisor.snapshot() : Object.freeze({ state: "idle", connected: false, generation: 0 }),
    getLicense: () => verifiedLicense
  });
}

module.exports = { createClient };
