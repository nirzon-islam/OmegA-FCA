"use strict";

function createGoatBotLogin(client) {
  if (!client || typeof client.login !== "function") throw new TypeError("OmegA-FCA client is required");

  return function goatBotLogin(credentials, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (typeof callback !== "function") throw new TypeError("GoatBot login callback is required");
    const input = credentials && typeof credentials === "object" ? credentials : {};
    let loginInput;
    if (Array.isArray(input.appState)) {
      loginInput = { mode: "appstate", appState: input.appState };
    } else if ((typeof input.username === "string" || typeof input.email === "string") &&
        typeof (input.password || input.pass) === "string") {
      loginInput = {
        mode: "credentials",
        ...(typeof input.username === "string" && input.username.trim()
          ? { username: input.username.trim() }
          : { email: input.email }),
        password: input.password || input.pass,
        twoFactorSecret: input.twoFactorSecret || input["2FASecret"] || null,
        twoFactorCode: input.twoFactorCode || input.twoFactorCodeOrCode || input.twoFactorSecretOrCode || input["2FACode"] || null,
        userAgent: input.userAgent || null,
        proxy: input.proxy || null
      };
    } else {
      const error = new TypeError("GoatBot login requires an AppState array or FB_USERNAME/password credentials");
      error.retryable = false;
      callback(error);
      return Promise.resolve(null);
    }

    // Keep login rejection handling separate from callback execution. A user
    // callback may itself throw; that must not be mistaken for a login failure
    // and cause the callback to be invoked a second time.
    return client.login(loginInput, options || {}).then(
      api => {
        callback(null, api);
        return api;
      },
      error => {
        callback(error);
        return null;
      }
    );
  };
}

module.exports = { createGoatBotLogin };
