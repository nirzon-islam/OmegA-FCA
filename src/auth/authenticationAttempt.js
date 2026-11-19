"use strict";

const STATES = Object.freeze([
  "idle", "authenticating", "challenge_required", "verifying_challenge",
  "authenticated", "failed", "closed"
]);

function publicChallenge(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Authentication provider returned an invalid challenge");
  }
  const type = typeof value.type === "string" && value.type.trim()
    ? value.type.trim().slice(0, 64) : "verification";
  const message = typeof value.message === "string" ? value.message.slice(0, 500) : null;
  const methods = Array.isArray(value.methods)
    ? value.methods.filter(item => typeof item === "string").map(item => item.trim().slice(0, 64)).filter(Boolean).slice(0, 10) : [];
  return Object.freeze({ type, message, methods: Object.freeze(methods) });
}

/**
 * Owns one authentication attempt and its owner-mediated challenge handoff.
 *
 * The provider must return either { status: "authenticated", session } or
 * { status: "challenge_required", challenge, resume(answer) }. The resume
 * function remains private to this attempt and must continue the same
 * provider-owned session; callers only receive the sanitized challenge.
 */
function createAuthenticationAttempt({ authenticate, maxChallengeRounds = 3 } = {}) {
  if (typeof authenticate !== "function") throw new TypeError("authenticate must be a function");
  if (!Number.isInteger(maxChallengeRounds) || maxChallengeRounds < 1 || maxChallengeRounds > 5) {
    throw new RangeError("maxChallengeRounds must be between 1 and 5");
  }

  let state = "idle";
  let challenge = null;
  let resumeProvider = null;
  let credentials = null;
  let options = null;
  let session = null;
  let operation = null;
  let challengeRounds = 0;
  let lastError = null;

  function snapshot() {
    return Object.freeze({
      state,
      challenge,
      challengeRounds,
      authenticated: state === "authenticated",
      error: lastError ? Object.freeze({
        name: lastError.name || "Error",
        code: typeof lastError.code === "string" ? lastError.code : null,
        message: "Authentication failed; inspect the provider error securely"
      }) : null
    });
  }

  function ensureOpen() {
    if (state === "closed") throw new Error("Authentication attempt is closed");
  }

  async function consume(result) {
    if (!result || typeof result !== "object") {
      throw new TypeError("Authentication provider returned an invalid result");
    }
    if (result.status === "authenticated") {
      if (!result.session || typeof result.session !== "object") {
        throw new TypeError("Authenticated result must include a session object");
      }
      session = result.session;
      resumeProvider = null;
      challenge = null;
      credentials = null;
      options = null;
      state = "authenticated";
      return session;
    }
    if (result.status === "challenge_required") {
      if (typeof result.resume !== "function") {
        throw new TypeError("Challenge result must include a resume(answer) function");
      }
      challengeRounds += 1;
      if (challengeRounds > maxChallengeRounds) {
        throw Object.assign(new Error("Authentication challenge limit exceeded"), {
          code: "FCA_CHALLENGE_LIMIT", retryable: false
        });
      }
      challenge = publicChallenge(result.challenge);
      resumeProvider = result.resume;
      state = "challenge_required";
      return null;
    }
    throw new TypeError("Authentication provider status must be authenticated or challenge_required");
  }

  function begin(input, loginOptions = {}) {
    ensureOpen();
    if (state !== "idle") return Promise.reject(new Error("Authentication attempt has already started"));
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return Promise.reject(new TypeError("Authentication credentials must be an object"));
    }
    credentials = input;
    options = loginOptions && typeof loginOptions === "object" ? loginOptions : {};
    state = "authenticating";
    operation = Promise.resolve().then(() => authenticate({ credentials, options }))
      .then(consume)
      .catch(error => {
        lastError = error instanceof Error ? error : new Error("Authentication provider failed");
        state = "failed";
        resumeProvider = null;
        challenge = null;
        credentials = null;
        options = null;
        throw lastError;
      })
      .finally(() => { operation = null; });
    return operation;
  }

  function submitChallenge(answer) {
    ensureOpen();
    if (state !== "challenge_required" || typeof resumeProvider !== "function") {
      return Promise.reject(new Error("No authentication challenge is waiting for an answer"));
    }
    if (operation) return Promise.reject(new Error("Authentication operation is already in progress"));
    if (answer == null || (typeof answer !== "string" && (typeof answer !== "object" || Array.isArray(answer)))) {
      return Promise.reject(new TypeError("Challenge answer must be a string or an object"));
    }
    const resume = resumeProvider;
    resumeProvider = null;
    state = "verifying_challenge";
    operation = Promise.resolve().then(() => resume(answer))
      .then(consume)
      .catch(error => {
        lastError = error instanceof Error ? error : new Error("Challenge verification failed");
        state = "failed";
        resumeProvider = null;
        challenge = null;
        credentials = null;
        options = null;
        throw lastError;
      })
      .finally(() => { operation = null; });
    return operation;
  }

  async function close() {
    if (state === "closed") return;
    if (operation) {
      try { await operation; } catch {}
    }
    const active = session;
    session = null;
    resumeProvider = null;
    challenge = null;
    credentials = null;
    options = null;
    state = "closed";
    if (active && typeof active.close === "function") await active.close();
  }

  return Object.freeze({ begin, submitChallenge, close, snapshot });
}

module.exports = { createAuthenticationAttempt, AUTHENTICATION_ATTEMPT_STATES: STATES };
