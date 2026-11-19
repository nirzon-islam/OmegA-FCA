# OmegA-FCA implementation status

## Implemented in the current branch

- Node.js 20+ CommonJS package, root exports and TypeScript declarations.
- Cookie/AppState parsing and validation, encrypted session helpers, restrictive file permissions and secret redaction.
- **New native personal-session foundation:** `createPersonalSession()` validates an owner-supplied AppState against Facebook over HTTPS, scopes session cookies to Facebook/Messenger hosts, provides bounded-time authenticated web requests, and reports expired sessions/checkpoints without bypassing them.
- Bounded HTTPS request helper and secure cookie jar.
- Connection supervisor with bounded reconnect/backoff, listener recovery and abortable connect attempts.
- Event dispatcher with duplicate coalescing, success-only acknowledgement and per-thread ordering.
- Injectable transport contract and GoatBot callback-login adapter.
- **New:** `createLegacyFcaProvider()` bridges an existing callback-style personal-account FCA implementation into OmegA-FCA's transport contract. It maps AppState or credentials login, manual 2FA inputs, current-user lookup, MQTT listener lifecycle and supported FCA methods.
- Manual 2FA input plumbing; checkpoint and expired-session classification. The owner must resolve Facebook challenges through the platform.
- Optional Ed25519 licensing and signed update-manifest verification.
- Separate official Meta Messenger Page transport and webhook example.

## Not yet implemented — standalone personal FCA blockers

This package is **not yet a standalone, drop-in personal-account FCA replacement**.

- OmegA-FCA does not yet implement the full personal-account authentication flow (username/password + 2FA), Facebook private HTTP/GraphQL action layer, or response normalization. The new AppState session bootstrap is only the first authentication/session layer.
- OmegA-FCA does not yet implement Facebook web-client MQTT/WebSocket protocol or event decoding. The legacy adapter remains a temporary compatibility/test utility and is not the target runtime; the goal is a native OmegA-FCA transport.
- Full parity with every legacy FCA method, event shape, and GoatBot call site has not been proven.
- No authorized live personal-account end-to-end test has been run from this repository.
- The GoatBot branch has not yet been switched to this package or integration-tested.

The adapter is a compatibility bridge, not a claim that the missing Facebook protocol has been recreated. The Page transport is separate and is not a substitute for a personal account.

## Verification gate

Synthetic AppState session and adapter tests have been added. GitHub Actions must run on the latest branch commit before claiming the test suite passes. A real authorized account test is still required for login, MQTT readiness, message receive/send, group actions, reconnect, and checkpoint/session-expiry reporting.

Never commit live cookies, AppState, passwords, 2FA material, Page tokens, or encryption keys. Do not bypass checkpoints or platform security controls.
