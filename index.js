"use strict";

const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");
const { createDiagnosticRecorder } = require("./src/security/diagnostics");
const { classifySessionState, describeError } = require("./src/security/sessionState");
const { encryptSession, decryptSession } = require("./src/security/sessionCrypto");
const { saveSession, loadSession, deleteSession } = require("./src/security/sessionStore");
const { ConnectionSupervisor } = require("./src/runtime/connection");
const { EventDispatcher } = require("./src/events/dispatcher");
const { CookieJar } = require("./src/network/cookieJar");
const { createRequestClient, retryAfterMs, isRetryableStatus } = require("./src/network/requestClient");
const { createPersonalSession, detectSessionChallenge, extractIdentity, extractFacebookTokens } = require("./src/auth/personalSession");
const { createAuthenticationAttempt, AUTHENTICATION_ATTEMPT_STATES } = require("./src/auth/authenticationAttempt");
const { parseAccountText, loadAccountConfig } = require("./src/auth/accountConfig");
const { normalizeFacebookResponse, stripFacebookJsonPrefix, createFacebookError } = require("./src/auth/facebookResponse");
const { createFacebookWebClient, assertFacebookUrl, toFormBody } = require("./src/auth/facebookWebClient");
const { createClient } = require("./src/api/client");
const { createGoatBotLogin } = require("./src/compat/goatbotLogin");
const { createLegacyFcaProvider } = require("./src/compat/legacyFcaTransport");
const { verifyLicenseToken } = require("./src/license/verify");
const { createLicenseProvider } = require("./src/license/provider");
const { validateTransportDriver, createTransportFactory } = require("./src/transport/contract");
const { createMetaMessengerTransport, normalizeWebhookPayload, verifyWebhookSignature, verifyWebhookChallenge } = require("./src/transport/metaMessenger");
const { parseVersion, compareVersions, verifyUpdateManifest, verifyArtifactDigest } = require("./src/update/manifest");

module.exports = {
  normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies,
  redactSecrets, createDiagnosticRecorder, classifySessionState, describeError, encryptSession, decryptSession,
  saveSession, loadSession, deleteSession, ConnectionSupervisor, EventDispatcher,
  CookieJar, createRequestClient, retryAfterMs, isRetryableStatus, createPersonalSession, detectSessionChallenge, extractIdentity, extractFacebookTokens,
  createAuthenticationAttempt, AUTHENTICATION_ATTEMPT_STATES,
  parseAccountText, loadAccountConfig,
  normalizeFacebookResponse, stripFacebookJsonPrefix, createFacebookError,
  createFacebookWebClient, assertFacebookUrl, toFormBody, createClient,
  createGoatBotLogin, createLegacyFcaProvider, verifyLicenseToken, createLicenseProvider,
  validateTransportDriver, createTransportFactory, createMetaMessengerTransport,
  normalizeWebhookPayload, verifyWebhookSignature, verifyWebhookChallenge,
  parseVersion, compareVersions, verifyUpdateManifest, verifyArtifactDigest,
  version: require("./package.json").version
};
