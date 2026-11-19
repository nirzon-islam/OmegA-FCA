# Authentication attempt coordinator

`createAuthenticationAttempt()` is a provider-neutral lifecycle helper for owner-mediated login challenges. It does not perform Facebook login and does not contain Facebook endpoints, cookies, credentials, or protocol assumptions.

A provider passed as `authenticate` returns one of:

- `{ status: "authenticated", session }` after it has independently completed authentication.
- `{ status: "challenge_required", challenge, resume(answer) }` when the same provider-owned login attempt is waiting for an owner response.

The coordinator exposes:

- `begin(credentials, options)` to start exactly one attempt.
- `snapshot()` to read a sanitized state and challenge description.
- `submitChallenge(answer)` to continue the provider-owned attempt once.
- `close()` to close an authenticated session and discard retained references.

States: `idle`, `authenticating`, `challenge_required`, `verifying_challenge`, `authenticated`, `failed`, and `closed`.

Challenge answers are passed only to the provider's continuation callback. The coordinator does not log or persist them. The default maximum is three challenge rounds (configurable from one to five). Exceeding the limit fails the attempt. Challenge details exposed through `snapshot()` are reduced to type, message, and method names.

## Minimal provider contract

```js
const { createAuthenticationAttempt } = require("@omega/fca");

const attempt = createAuthenticationAttempt({
  authenticate: async ({ credentials, options }) => {
    // Provider owns the actual login transport and its private session.
    const pending = await provider.begin(credentials, options);

    if (pending.status === "challenge_required") {
      return {
        status: "challenge_required",
        challenge: pending.challenge,
        resume: answer => pending.continue(answer)
      };
    }

    return { status: "authenticated", session: pending.session };
  }
});

const sessionOrNull = await attempt.begin({ username, password });
if (!sessionOrNull) {
  const { challenge } = attempt.snapshot();
  // Obtain the answer directly from the account owner, then:
  const session = await attempt.submitChallenge(ownerSuppliedAnswer);
}
```

The snippet is illustrative only: no Facebook credential provider is included yet. Do not store credentials or challenge answers in source control, logs, or shared services. Checkpoints must be resolved by the account owner through Facebook's own verification process.
