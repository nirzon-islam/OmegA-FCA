"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthenticationAttempt } = require("../src/auth/authenticationAttempt");

test("authentication attempt resumes the same provider-owned challenge session", async () => {
  const calls = [];
  const session = { userId: "owner-1" };
  const attempt = createAuthenticationAttempt({
    authenticate: async input => {
      calls.push(["authenticate", input.credentials.username]);
      return {
        status: "challenge_required",
        challenge: { type: "two_factor", message: "private password hunter2", methods: ["totp"] },
        resume: async answer => {
          calls.push(["resume", answer]);
          return { status: "authenticated", session };
        }
      };
    }
  });

  assert.equal(await attempt.begin({ username: "owner" }), null);
  assert.deepEqual(attempt.snapshot(), {
    state: "challenge_required",
    challenge: { type: "two_factor", message: "Additional account verification is required.", methods: ["totp"] },
    challengeRounds: 1,
    authenticated: false,
    error: null
  });
  assert.equal(await attempt.submitChallenge("123456"), session);
  assert.deepEqual(calls, [["authenticate", "owner"], ["resume", "123456"]]);
  assert.equal(attempt.snapshot().state, "authenticated");
  assert.equal(attempt.snapshot().challenge, null);
  await attempt.close();
  assert.equal(attempt.snapshot().state, "closed");
});

test("challenge answers cannot be submitted before a challenge exists", async () => {
  const attempt = createAuthenticationAttempt({
    authenticate: async () => ({ status: "authenticated", session: {} })
  });
  await assert.rejects(attempt.submitChallenge("123456"), /No authentication challenge/);
  await attempt.begin({});
  await assert.rejects(attempt.submitChallenge("123456"), /No authentication challenge/);
});

test("challenge continuation is single-use and bounded", async () => {
  let resumes = 0;
  let cancelled = 0;
  const attempt = createAuthenticationAttempt({
    maxChallengeRounds: 1,
    authenticate: async () => ({
      status: "challenge_required",
      challenge: { type: "verification" },
      resume: async () => {
        resumes += 1;
        return {
          status: "challenge_required",
          challenge: { type: "verification" },
          resume: async () => ({ status: "authenticated", session: {} }),
          cancel: async () => { cancelled += 1; }
        };
      }
    })
  });
  await attempt.begin({});
  await assert.rejects(attempt.submitChallenge("first"), /challenge limit exceeded/);
  assert.equal(resumes, 1);
  assert.equal(cancelled, 1);
  assert.equal(attempt.snapshot().state, "failed");
});

test("closing an authenticated attempt closes its owned session", async () => {
  let closed = 0;
  const attempt = createAuthenticationAttempt({
    authenticate: async () => ({ status: "authenticated", session: { close: async () => { closed += 1; } } })
  });
  await attempt.begin({});
  await attempt.close();
  await attempt.close();
  assert.equal(closed, 1);
});

test("provider failures discard pending challenge state", async () => {
  const attempt = createAuthenticationAttempt({
    authenticate: async () => { throw Object.assign(new Error("provider echoed password hunter2"), { code: "AUTH_REJECTED" }); }
  });
  await assert.rejects(attempt.begin({}), /rejected/);
  assert.equal(attempt.snapshot().state, "failed");
  assert.equal(attempt.snapshot().error.code, undefined);
  assert.equal(attempt.snapshot().error.message, "Authentication failed; inspect the provider error securely");
  assert.equal(JSON.stringify(attempt.snapshot()).includes("hunter2"), false);
  await assert.rejects(attempt.submitChallenge("123456"), /No authentication challenge/);
});

test("closing a pending challenge cancels provider-owned state exactly once", async () => {
  let cancelled = 0;
  const attempt = createAuthenticationAttempt({
    authenticate: async () => ({
      status: "challenge_required",
      challenge: { type: "two_factor", message: "password=hunter2" },
      resume: async () => ({ status: "authenticated", session: {} }),
      cancel: async () => { cancelled += 1; }
    })
  });
  await attempt.begin({});
  assert.equal(attempt.snapshot().challenge.message, "Additional account verification is required.");
  assert.equal(JSON.stringify(attempt.snapshot()).includes("hunter2"), false);
  await attempt.close();
  await attempt.close();
  assert.equal(cancelled, 1);
});

test("public error snapshot does not expose provider-controlled name or malformed code", async () => {
  const attempt = createAuthenticationAttempt({
    authenticate: async () => {
      const error = new Error("secret");
      error.name = "password=hunter2";
      error.code = "hunter2";
      throw error;
    }
  });
  await assert.rejects(attempt.begin({}));
  assert.deepEqual(attempt.snapshot().error, {
    name: "Error",
    code: null,
    message: "Authentication failed; inspect the provider error securely"
  });
  assert.equal(JSON.stringify(attempt.snapshot()).includes("hunter2"), false);
});

test("challenge metadata only exposes bounded identifier-like values", async () => {
  const attempt = createAuthenticationAttempt({
    authenticate: async () => ({
      status: "challenge_required",
      challenge: { type: "password=hunter2", methods: ["totp", "cookie=private", "email"] },
      resume: async () => ({ status: "authenticated", session: {} })
    })
  });
  await attempt.begin({});
  assert.deepEqual(attempt.snapshot().challenge, {
    type: "verification",
    message: "Additional account verification is required.",
    methods: ["totp", "email"]
  });
  assert.equal(JSON.stringify(attempt.snapshot()).includes("hunter2"), false);
});

test("failed challenge continuation cancels pending provider state", async () => {
  let cancelled = 0;
  const attempt = createAuthenticationAttempt({
    authenticate: async () => ({
      status: "challenge_required",
      challenge: { type: "two_factor" },
      resume: async () => { throw Object.assign(new Error("verification rejected"), { code: "AUTH_REJECTED" }); },
      cancel: async () => { cancelled += 1; }
    })
  });
  await attempt.begin({});
  await assert.rejects(attempt.submitChallenge("123456"), /verification rejected/);
  assert.equal(cancelled, 1);
  assert.equal(attempt.snapshot().state, "failed");
  await attempt.close();
  assert.equal(cancelled, 1);
});
