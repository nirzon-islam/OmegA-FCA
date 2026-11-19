# OmegA-FCA implementation status

Last full CI validation before the TypeScript declaration commits: `5a8481bc93f9dd38e06e98d667ad700dd6189c62` (`public-package`). The declaration-only commits after that point have not yet been validated by CI.

## Implemented and CI-validated

- Node.js 20+ CommonJS package structure and public exports.
- Cookie/AppState parsing and validation, secret redaction, encrypted session helpers.
- Atomic encrypted session writes, restrictive file permissions, symlink-resistant session reads.
- Bounded HTTPS request client with caller cancellation and retry safeguards.
- Connection supervisor with retry/backoff, listener recovery, start/stop race handling, and abortable in-flight connect attempts.
- Event dispatcher with duplicate suppression and per-thread ordering.
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
- CI matrix validates Node 20 and 22 with `npm test` and recursive syntax checks, including examples (at the last validated commit above).
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
