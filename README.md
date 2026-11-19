# OmegA-FCA

Private, owner-licensed FCA-compatible client library for OmegA projects.

## Status

**Development: 0.1.0 — transport foundation.** This repository is the private source of truth. Do not place proprietary implementation files in the public OmegA-Goatbot repository.

## Design goals

- Independent implementation; no copied FCA source.
- Node.js 20+ and CommonJS compatibility for the current GoatBot runtime.
- Explicit login modes: AppState/cookie and credentials (including manual 2FA/checkpoint handling).
- Safe session lifecycle, bounded reconnect/backoff, listener deduplication, and redacted diagnostics.
- AES-256-GCM encrypted session persistence helpers.
- Ed25519 signed owner-issued license verification; production client login requires a valid license by default.
- GoatBot callback-style login adapter and MQTT listener compatibility surface.
- Agent Backend integration through its existing signed bridge and one-time recovery handoff.

## Current implementation

- Facebook cookie/AppState input normalization, Cookie header and Netscape format parsing.
- Required c_user and xs validation at login boundary.
- Recursive secret redaction for diagnostic payloads.
- AES-256-GCM session encryption/decryption and atomic encrypted file persistence with restrictive permissions.
- Ed25519 license token verification with issuer, product, expiry, owner, and installation checks.
- Agent Backend license refresh provider using HTTPS; refresh credentials are sent only in the request body and never logged by this package.
- Transport-neutral API facade and connection supervisor with bounded exponential reconnect delay, permanent-error handling, and one active listener.
- Bounded duplicate-event suppression and per-thread event ordering.
- Domain/path/expiry/secure-aware cookie jar and bounded HTTPS retry client that respects Retry-After and never retries authentication failures by default.
- GoatBot callback-style login adapter for AppState and email/password input.
- GitHub Actions CI using Node.js 20 and Node's built-in test runner.

**Not implemented yet:** Facebook authentication/transport protocol, MQTT wire protocol/event decoding, full message/thread API coverage, and the final GoatBot runtime integration. The transport facade currently requires an injected authenticate implementation; it is not yet a working Facebook login client.

## License setup

The owner issues an installation-bound license from the Agent Backend. The runtime stores the license ID, one-time license key, installation ID, and Ed25519 public key in its secret manager. Use createLicenseProvider to refresh a 15-minute signed token before client login; createClient verifies the token before allowing authentication. Revoked licenses cannot refresh, and an already-issued token remains usable only until its short expiry.

## Security boundaries

This project does not bypass Facebook checkpoints, 2FA, rate limits, or other account security controls. Unofficial Facebook interfaces can change without notice; no implementation can guarantee an account will never be checkpointed or restricted. Never commit live cookies, passwords, AppState, license keys, or access tokens.

Session encryption keys must be kept outside source control and supplied by the host through a secret manager/environment variable. Never store raw sessions in logs, task history, or dashboard responses.

## Development

Run npm test and npm run test:syntax with Node.js 20+.

Use synthetic fixtures only. For live-account validation, do not paste credentials into chat or commit them to the repository.
