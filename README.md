# OmegA-FCA

Independent, security-focused FCA compatibility library for Node.js 20+.

**Package:** `@omega/fca`  
**Status:** `0.1.1` — transport foundation (not a working Facebook login client yet).

## What this package provides

- CommonJS API for Node.js 20+
- AppState/cookie normalization and validation
- Secret redaction for diagnostics
- AES-256-GCM session encryption and encrypted file persistence helpers
- Connection supervision with bounded reconnect/backoff
- Event dispatching with duplicate suppression and per-thread ordering
- Cookie jar and bounded HTTPS request helper
- GoatBot callback-style login adapter
- Optional Ed25519 license verification for deployments that explicitly need it

## Important implementation status

The package is **not yet a complete Facebook Messenger client**. Facebook authentication, the transport/protocol implementation, MQTT wire protocol and event decoding, and complete message/thread API coverage are not implemented. A caller must inject an independently implemented transport factory into `createClient({ authenticate })`. The library deliberately fails when that provider is absent; it does not pretend that a session is connected.

Do not use this package as a drop-in replacement for an existing FCA until the Facebook transport and integration tests are complete.

## Install

```bash
npm install @omega/fca
```

## API foundation example

This demonstrates the transport contract only. It does not authenticate to Facebook by itself.

```js
const { createClient } = require("@omega/fca");

const client = createClient({
  // Supply a real, independently implemented transport provider.
  // It must return a driver with listen(callback), plus the API methods
  // your application intends to call.
  authenticate: async ({ mode, credentials, options, context }) => {
    throw new Error("Facebook transport is not implemented");
  }
});

client.login({ mode: "appstate", appState: [] })
  .catch(error => console.error("Login unavailable:", error.message));
```

## GoatBot compatibility

`createGoatBotLogin(client)` adapts the promise-based client login to GoatBot's callback-style login signature. The adapter does not supply the missing Facebook transport.

## Runtime capabilities

After a successful provider login, `api.getCapabilities()` returns a frozen snapshot of the methods actually supplied by that transport driver, whether event listening is available, and whether optional session-guard support exists. The current package reports E2EE as unavailable. This is a capability report, not proof that a provider's Facebook actions or protocol behavior are correct.

## Session security

- Never commit cookies, AppState, passwords, 2FA secrets, session encryption keys, or tokens.
- Keep encryption keys in the host's secret manager/environment.
- Never log raw session material.
- Checkpoint and 2FA challenges must be completed by the account owner through legitimate platform flows.
- The package does not bypass checkpoints, 2FA, rate limits, or platform security controls.
- Unofficial platform interfaces can change without notice and can result in account restrictions.

## Optional licensing

Public package use does not require an OmegA owner-issued license. Advanced deployments may opt into the existing Ed25519 license verification by setting `requireLicense: true` and supplying a valid `license` configuration to `createClient`.

## Development

```bash
npm test
npm run test:syntax
```

Use synthetic fixtures for tests. Do not place live account credentials in issues, test fixtures, CI logs, or pull requests.

## License

MIT. See [LICENSE](LICENSE).
