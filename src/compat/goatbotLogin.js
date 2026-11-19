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
    } else if (typeof input.email === "string" && typeof (input.password || input.pass) === "string") {
      loginInput = {
        mode: "credentials",
        email: input.email,
        password: input.password || input.pass,
        twoFactorSecret: input.twoFactorSecret || input.twoFactorSecretOrCode || input["2FASecret"] || null,
        userAgent: input.userAgent || null,
        proxy: input.proxy || null
      };
    } else {
      const error = new TypeError("GoatBot login requires an AppState array or email/password credentials");
      error.retryable = false;
      callback(error);
      return Promise.resolve(null);
    }

    return client.login(loginInput, options || {})
      .then(api => {
        callback(null, api);
        return api;
      })
      .catch(error => {
        callback(error);
        return null;
      });
  };
}

module.exports = { createGoatBotLogin };
