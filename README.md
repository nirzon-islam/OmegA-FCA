# OmegA Bot — OmegA-FCA

**An independent FCA-compatible transport foundation by NirZon.**

OmegA-FCA is the Facebook integration foundation maintained under the **OmegA Bot** brand by **NirZon**. It provides security-focused session utilities, a transport/provider contract, GoatBot callback-login adaptation, and an official Meta Messenger Page transport.

> **Current status:** version `0.1.1` — transport foundation. This is not yet a drop-in personal-account FCA replacement and does not currently implement native personal-account Facebook login.

**Project owner / author:** NirZon  
**Brand:** OmegA Bot  
**Package:** `@omega/fca`  
**Node.js:** 20+

Current implementation and release status: [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md). Deployment instructions for the supported Page transport: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## About OmegA Bot

OmegA Bot is the project brand for this library. The project is developed and maintained by **NirZon**. The codebase is being built as an independent, security-conscious foundation with clear transport boundaries and honest compatibility reporting.

## What is included

- CommonJS API for Node.js 20+
- AppState/cookie normalization and validation
- Optional manually entered `twoFactorCode` plumbing for a supplied authentication provider
- Checkpoint and expired-session classification; automatic retries stop so the account owner can resolve the issue through Facebook
- Secret redaction for diagnostics
- AES-256-GCM session encryption and encrypted file persistence helpers
- Connection supervision with bounded reconnect/backoff
- Event dispatching with in-flight duplicate coalescing, retry-safe acknowledgement, and per-thread ordering
- Cookie jar and bounded HTTPS request helper
- GoatBot callback-style login adapter
- Official Meta Messenger Page transport: Page messaging, profile lookup, conversation/message reads, typing/read actions, and signed webhook ingestion
- Optional Ed25519 license verification for deployments that explicitly need it
- Public TypeScript declarations (`index.d.ts`)

## Important compatibility notice

OmegA-FCA is **not currently a drop-in replacement for a personal-account FCA**.

The official Meta Messenger Page transport is implemented separately and supports Page-token Send API calls, Page conversation/message reads, sender actions, and HMAC-verified webhook events.

The following personal-account capabilities are not implemented yet:

- Native personal-account browser-session/AppState authentication
- Private Facebook HTTP/GraphQL actions
- Facebook web-client MQTT/WebSocket protocol and event decoding
- Full legacy FCA and GoatBot personal-inbox/group API compatibility

The generic `createClient({ authenticate })` requires an independently supplied transport provider. Do not switch an existing OmegA Bot or GoatBot deployment to this package as a drop-in FCA replacement until the missing transport and authorized integration tests are complete.

For the supported Page-based integration, read [the official Meta transport guide](docs/META-MESSENGER-TRANSPORT.md).

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
  authenticate: async () => {
    throw new Error("Personal-account Facebook transport is not implemented");
  }
});

client.login({ mode: "appstate", appState: [] })
  .catch(error => console.error("Login unavailable:", error.message));
```

## Official Meta Messenger Page transport

For supported Facebook Page messaging, see [docs/META-MESSENGER-TRANSPORT.md](docs/META-MESSENGER-TRANSPORT.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

This integration uses Meta's supported Page access token and webhook model. It does not provide personal-account FCA behavior, browser-session emulation, or MQTT.

## GoatBot compatibility

`createGoatBotLogin(client)` adapts promise-based client login to GoatBot's callback-style login signature. The adapter does not supply the missing personal-account Facebook transport or guarantee full legacy FCA compatibility.

## Session security

- Never commit cookies, AppState, passwords, 2FA secrets, session encryption keys, or tokens.
- Keep encryption keys and Page credentials in the hosting provider's secret manager.
- Never log raw session material.
- Checkpoint challenges must be completed by the account owner through legitimate platform flows.
- Providers may accept a manually entered `twoFactorCode`; this library does not generate, intercept, or bypass challenges.
- The package does not bypass checkpoints, 2FA, rate limits, or platform security controls.
- Unofficial platform interfaces can change without notice and can result in account restrictions.

## Optional licensing

Public package use does not require an OmegA owner-issued license. Advanced deployments may opt into the existing Ed25519 license verification by setting `requireLicense: true` and supplying a valid `license` configuration to `createClient`.

## Development and tests

```bash
npm ci
npm test
npm run test:syntax
npm pack --dry-run
```

Use synthetic fixtures for tests. Do not place live account credentials in issues, test fixtures, CI logs, or pull requests. Session files are written with restrictive permissions; keep their parent directory private and protect the encryption key separately.

## Project ownership

**OmegA Bot**  
Developed and maintained by **NirZon**.

## License

MIT. See [LICENSE](LICENSE).
