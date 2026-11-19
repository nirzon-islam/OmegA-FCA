# OmegA-FCA implementation status

Last successful full CI run: #44467563604 on commit `b944f7ebf63c039e69d0cca41562e37c1196ce78` (`public-package`). Later security and type-definition changes are pending a fresh full CI run.

## Implemented and CI-validated

- Node.js 20+ CommonJS package structure and public exports.
- Cookie/AppState parsing and validation with RFC cookie-octet checks against Cookie-header injection, expanded secret redaction, encrypted session helpers.
- CookieJar now refuses to send Facebook session cookies over plain HTTP.
- Atomic encrypted session writes, restrictive file permissions, symlink-resistant session reads.
- Bounded HTTPS request client with caller cancellation and retry safeguards.
- Connection supervisor with retry/backoff, listener recovery, start/stop race handling, and abortable in-flight connect attempts.
- Event dispatcher with in-flight duplicate coalescing, success-only acknowledgement, retry after handler failure, and per-thread ordering.
- Transport contract and injectable provider interface.
- GoatBot callback adapter foundation and documented compatibility audit.
- Optional Ed25519 licensing; public package use does not require a license by default.
- Official Meta Messenger Page transport:
  - Page access token via Authorization header.
  - Configurable Graph API version.
  - Send API message requests with no automatic retry of POST sends.
  - HMAC-SHA256 webhook signature verification over original raw bytes.
  - Payload parsing only after signature verification.
  - Webhook challenge verification.
  - Normalization for message, postback, delivery, read, account-linking, and referral events.
  - Callback exception isolation.
- Runnable Node.js webhook server example and environment template.
- CI matrix validates Node 20 and 22 with `npm test` and recursive syntax checks, including examples (last successful run above).
- TypeScript declarations are published through the package `types` entry; package wiring is covered by tests, but a full `tsc` compile check is not yet included.
- Public TypeScript declaration file and package `types` entry have been added; declaration type-checking is not yet part of CI.

## Explicitly not implemented

This package is **not yet a drop-in personal-account FCA replacement**.

- Personal-account browser-session/AppState authentication against private Facebook endpoints.
- Private GraphQL/browser HTTP action implementations.
- Facebook web-client MQTT/WebSocket wire protocol and frame decoding.
- Full legacy FCA API and GoatBot personal-inbox/group API compatibility.
- End-to-end integration tests against a real Page/app configuration or an authorized test account.

The official Meta Messenger transport is a separate supported Page integration. It does not emulate a personal profile, use MQTT, or satisfy legacy personal-account FCA behavior.

## Release gate

Do not replace GoatBot's existing FCA dependency or publish a drop-in compatibility release until the intended target is decided, the missing compatibility surface is implemented through an approved approach, and the complete integration suite passes. Never put live Page tokens, app secrets, cookies, or AppState in the repository or CI.
