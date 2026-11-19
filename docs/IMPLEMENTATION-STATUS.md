# OmegA-FCA implementation status

## Implemented in the current branch

- Node.js 20+ CommonJS package, root exports and TypeScript declarations.
- Cookie/AppState parsing and validation, encrypted session helpers, restrictive file permissions and secret redaction.
- **Updated:** account configuration now treats `account.txt` as AppState/cookie-only and rejects credential-like key/value text. Credential configuration reads canonical `facebookAccount.fb_email` (legacy `email` and `FB_EMAIL` environment aliases remain supported); it does not read `fb_username`.
- **New AppState test entry point:** `npm run test:appstate` validates an owner-supplied AppState from `account.txt` (or the documented `appstate.json` fallback), reports only non-secret session metadata, and is deliberately excluded from CI because it requires a real authorized session and network access.
- **New native personal-session foundation:** `createPersonalSession()` validates an owner-supplied AppState against Facebook over HTTPS, scopes session cookies to Facebook/Messenger hosts, provides bounded-time authenticated web requests, and reports expired sessions/checkpoints without bypassing them.
- Bounded HTTPS request helper and secure cookie jar.
- **New safe diagnostics utility:** bounded metadata-only recorder, integrated with AppState-backed personal-session requests; excludes header/query/body/response values and credential material.
- **New authenticated Facebook web client:** `createFacebookWebClient()` adds token-aware POST form serialization, GET/HEAD/POST handling, strict Facebook/Messenger HTTPS host validation, manual redirect classification (checkpoint/expired/unexpected), normalized JSON/error responses, and 2 MiB inbound/outbound body limits. It intentionally does not invent private action endpoints or payload schemas.
- Connection supervisor with bounded reconnect/backoff, listener recovery and abortable connect attempts.
- Event dispatcher with duplicate coalescing, success-only acknowledgement and per-thread ordering.
- Injectable transport contract and GoatBot callback-login adapter.
- **New protocol-neutral native WebSocket runtime:** bounded connect/close waits, abort-aware connection setup, protocol-adapter hooks for authentication/subscription/frame decoding/action encoding, bounded frame handling, listener lifecycle, diagnostics metadata, and deterministic fake-socket tests. This is transport infrastructure only; it does not include Facebook's private handshake, endpoint, subscription topics, or action schemas.
- **New OASIS MQTT 3.1.1 codec primitives:** CONNECT, PUBLISH, SUBSCRIBE, UNSUBSCRIBE, packet acknowledgements, PINGREQ and DISCONNECT encoding plus bounded packet decoding and specification-based unit fixtures. This is broker-agnostic MQTT protocol support, not a Facebook MQTT session implementation.
- **New research register (2026-11-20):** separates Meta's historical MQTT/snapshot-delta architecture statements, OASIS MQTT 3.1.1 normative transport rules, and unofficial FCA source observations from current Facebook-specific facts.
- **New:** `createLegacyFcaProvider()` bridges an existing callback-style personal-account FCA implementation into OmegA-FCA's transport contract. It maps AppState or credentials login, manual 2FA inputs, current-user lookup, MQTT listener lifecycle and supported FCA methods.
- Manual 2FA input plumbing; checkpoint and expired-session classification. The owner must resolve Facebook challenges through the platform. The repository configuration loader does not treat `account.txt` as a credential source.
- Provider-neutral authentication-attempt coordinator with bounded challenge rounds, single-use continuation, optional provider cleanup on cancellation, and secret-safe public snapshots. This is lifecycle plumbing only; no Facebook credential provider is included.
- Optional Ed25519 licensing and signed update-manifest verification.
- Separate official Meta Messenger Page transport and webhook example.

## Not yet implemented — standalone personal FCA blockers

This package is **not yet a standalone, drop-in personal-account FCA replacement**.

- OmegA-FCA does not yet implement the full personal-account authentication flow (username/password + 2FA), complete Facebook private HTTP/GraphQL action catalog or endpoint-specific payload schemas. The new AppState session bootstrap and generic authenticated web-client layer are session/request foundations only; they do not constitute the FCA action API. Username/password login is not yet implemented natively; the username field is currently an input contract for the future auth provider.
- OmegA-FCA does not yet implement a verified Facebook web-client MQTT/WebSocket session adapter. The new native WebSocket runtime and broker-agnostic MQTT 3.1.1 codec supply transport primitives, but they do not establish the current Facebook protocol version, authentication metadata, broker/session negotiation, synchronization bootstrap, subscriptions, acknowledgements, event envelopes, or action encoding. The legacy adapter remains a temporary compatibility/test utility and is not the target runtime.
- Full parity with every legacy FCA method, event shape, and GoatBot call site has not been proven.
- No authorized live personal-account end-to-end test has been run from this repository. The new AppState smoke-test command is prepared but has not yet been run against a real account.
- The GoatBot branch has not yet been switched to this package or integration-tested.

The adapter is a compatibility bridge, not a claim that the missing Facebook protocol has been recreated. The Page transport is separate and is not a substitute for a personal account.

## Verification gate

Synthetic AppState session, authenticated web-client, redirect-classification, body-limit and adapter tests have been added. GitHub Actions must run on the latest branch commit before claiming the test suite passes. A real authorized account test is still required for login, MQTT readiness, message receive/send, group actions, reconnect, and checkpoint/session-expiry reporting.

Never commit live cookies, AppState, passwords, 2FA material, Page tokens, or encryption keys. Do not bypass checkpoints or platform security controls.
