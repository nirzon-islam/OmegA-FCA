# OmegA-FCA Architecture

> Status: design baseline for the transport implementation. This document does not claim that Facebook authentication or MQTT is implemented.

## Product direction

OmegA-FCA is an independently maintained Node.js library under the OmegA brand. It should provide:

- A stable CommonJS entry point for GoatBot and other Node.js applications.
- A promise-first API with a legacy callback adapter.
- A provider-owned authentication and transport implementation; no hidden third-party login relay.
- A normalized event model independent of raw transport frames.
- Encrypted session persistence, secret-safe diagnostics, bounded reconnect, and deterministic shutdown.
- Capability-aware API methods that fail clearly when a feature is unavailable.
- Synthetic unit tests and opt-in integration tests that never require real credentials in CI.

The library is unofficial and must not bypass account checkpoints, 2FA, platform rate limits, or other security controls. Users remain responsible for platform terms and account authorization.

## Runtime layers

```text
Public API (login / createClient / callback adapter)
                 |
         Client + capabilities
                 |
       Session and auth lifecycle
                 |
       Transport driver contract
          /             \
   HTTP request       Realtime stream
      layer           (MQTT/WebSocket)
          \             /
          Event normalization
                 |
      Event dispatcher / listeners
```

### 1. Public API

Keep the current CommonJS export stable. Expose a promise-first client and an explicit GoatBot compatibility adapter. The adapter should translate callback signatures only; it must not contain transport logic.

### 2. Authentication and session lifecycle

Separate session input parsing from authentication. Support AppState/cookie input first. Credential login is a later, opt-in flow and must return explicit challenge/checkpoint outcomes for the account owner to complete; do not automate or bypass security challenges.

Authentication must:
- Use only reviewed first-party endpoints and a directly controlled request path.
- Avoid third-party credential relays and remote code execution.
- Return a typed session result with user identity, cookie jar, negotiated tokens, and expiry/health metadata.
- Distinguish logged-out, checkpoint-required, transient-network, malformed-session, and unknown states.

### 3. Transport contract

Retain the existing injectable driver contract, but make capabilities explicit. A driver should own its HTTP request context and realtime connection and expose:
- `connect()` / authentication result
- `listen(callback)` and idempotent `disconnect()`
- supported API methods and a capability map
- connection health and structured errors

Do not report a method as supported unless the active driver implements it. Avoid a permissive no-op fallback.

### 4. Realtime and event pipeline

Implement the realtime transport as a separately testable module. Keep wire decoding separate from event normalization. The normalized event pipeline should:
- validate incoming frame shape and size;
- normalize message, reply, unsend, reaction, typing, read/delivery, presence, and thread updates;
- preserve per-thread ordering;
- suppress duplicate event IDs with a bounded TTL cache;
- isolate listener exceptions and expose structured errors;
- support exactly one active transport listener per client unless multi-listener behavior is deliberately designed and tested.

Reconnect belongs to the connection supervisor. It must tear down stale sockets and subscriptions before reconnecting, use bounded exponential backoff with jitter, and stop promptly on logout.

### 5. HTTP and action layer

Keep request transport, action serialization, and response parsing separate. Every action should declare:
- required inputs and validation;
- supported capability;
- retry policy (default: no retry for non-idempotent sends);
- timeout and response normalization;
- structured error mapping.

Do not blindly retry message sends or other non-idempotent operations because that can duplicate user-visible actions.

### 6. Session security

Preserve the existing encrypted session helpers and secret redaction. Add atomic persistence and corruption handling before relying on session files in production. Never commit cookies, AppState, passwords, 2FA secrets, tokens, or encryption keys. Never include raw session values in logs or thrown errors.

### 7. Compatibility strategy

Implement the smallest stable compatibility surface first:
1. Login and logout lifecycle.
2. `getCurrentUserID`, `listen` / `listenMqtt`.
3. `sendMessage`, `markAsRead`, `sendTypingIndicator`.
4. Thread and user reads.
5. Reactions, unsend/edit, attachments.
6. Group administration and less common social APIs.

GoatBot integration must be gated by a compatibility test suite. Do not replace its existing FCA dependency until the required commands and events pass those tests.

## Test strategy and release gates

- Unit tests: synthetic cookies, request fixtures, transport state machine, frame decoder, event normalizer, action serializers, and error mapping.
- Contract tests: every driver must pass lifecycle, capability, listener, and shutdown tests.
- Integration tests: explicitly opt-in, isolated test account, no credentials in CI, and no high-volume actions.
- Compatibility tests: compare event and method shapes expected by GoatBot, including callback ordering and error-first callbacks.
- Release gates: syntax, unit tests, type/API surface checks, dependency audit, secret scan, and a documented integration smoke test.

A release must not be called production-ready while authentication, realtime transport, event decoding, or required API coverage is missing.

## Research references

These are study references, not runtime dependencies and not a statement that their code is copied:

- VangBanLaNhat/fca-unofficial: https://github.com/VangBanLaNhat/fca-unofficial
  - Useful areas to study: separation of action modules, request/session helpers, event parsing, and MQTT integration.
  - Its package metadata declares MIT, but a root LICENSE file was not available during this review. Do not copy code until the license grant and notices are independently confirmed.
- dongp06/fca-unofficial: https://github.com/dongp06/fca-unofficial
  - Useful areas to study: documented flat compatibility API, namespaced facade, event-driven bot layer, and architecture docs.
  - Repository is archived; use as a design reference only.
- anbuinfosec/fca-unofficial: https://github.com/anbuinfosec/fca-unofficial
  - Useful as a GoatBot compatibility comparison, not as an authority for account safety or production reliability.

## Current implementation boundary

The current `createClient({ authenticate })` is a foundation, not an implemented Facebook client. The next engineering milestone is a reviewed transport design and independently testable session/HTTP/realtime boundaries. No placeholder provider, fake successful login, or dummy MQTT implementation should be added.
