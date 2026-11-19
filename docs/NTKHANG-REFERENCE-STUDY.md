# NTKhang GoatBot FCA — Independent Architecture Study

Reviewed: 2026-11-19
Target: OmegA-FCA native personal-account engine
Reference: https://github.com/ntkhang03/Goat-Bot-V2/tree/main/fb-chat-api

This is an independent behavioral and architectural study. It contains no copied implementation code and does not claim that historical protocol details remain current.

## Reference repository and licensing boundary

The GoatBot V2 repository identifies its bundled fb-chat-api as a detached FCA implementation. Its root LICENSE states MIT License (No Derivatives). OmegA-FCA must not copy, adapt, translate, or vendor that implementation. We can study externally observable behavior, public API contracts, and architectural separation, then implement our own code and tests from independently established requirements.

## What the reference implementation does

### 1. Login/bootstrap is a staged session lifecycle

The reference separates credential submission from authenticated API construction:
1. Create an isolated HTTP session and cookie jar for one account.
2. Fetch the login page and collect the session's current form state and cookies.
3. Submit the owner's username/email and password using the session's current form state.
4. Classify the result: invalid credentials, checkpoint/challenge, or authenticated session.
5. If the platform requires an owner challenge, suspend login and expose an explicit continuation operation. Do not treat a challenge page as successful login.
6. After owner verification, revalidate the same session and only then construct the authenticated API context.
7. Derive account identity from the authenticated session, not the supplied username.
8. Keep the cookie jar and account-specific tokens isolated to that client instance.

OmegA requirement: model this as a typed state machine: idle, authenticating, challenge_required, verifying_challenge, authenticated, failed, closed. Challenge continuation must be bound to the live attempt/session, reject stale or repeated submissions, preserve the same attempt, and never log challenge codes or secrets. Unknown challenge types must stop safely and explain that owner action is required.

### 2. Authenticated API construction is separate from login

The reference builds an account context after session establishment. API methods share that context and common request helpers rather than creating unrelated sessions.

OmegA requirement: one private session context owns the cookie jar and account identity; current request tokens and refresh lifecycle; HTTP client and redirect/challenge classifier; realtime connection and sync cursor state; request correlation and pending operation registry; lifecycle state and cleanup. No method may silently replace the authenticated client's account cookie jar.

### 3. Realtime is a protocol subsystem, not just a WebSocket

The reference listener uses MQTT over WebSocket, account/session identity, a connection lifecycle, topic subscriptions, initial synchronization, and incremental updates. It tracks synchronization cursor/token values and normalizes incoming message categories before exposing events.

OmegA requirement: separate endpoint/session bootstrap and handshake; MQTT connection adapter; subscription and sync coordinator; packet decoding and validation; delta/event normalization; public event dispatcher; reconnect and cursor recovery. A connected socket is not a ready listener. Emit ready only after required synchronization completes. Contain malformed/unknown packets. Reconnect must not duplicate listeners or acknowledge an event before processing succeeds.

### 4. HTTP actions need per-operation contracts

The reference exposes individual actions such as message send, thread queries, group operations, reactions, and attachment upload through shared request helpers. Each action has its own validation, serialization, response extraction, and error behavior.

OmegA requirement: build an action catalog from the actual GoatBot call-site inventory. For every method record exact public signature and callback/promise behavior; input validation and normalized identifiers; request operation and current token requirements; response schema and output normalization; retry safety; typed error mapping and session-state effects. Do not automatically retry non-idempotent writes without verified idempotency. Unknown response shapes must produce typed errors, not fabricated success objects.

### 5. Compatibility is larger than the login callback

The legacy GoatBot-facing surface includes identity lookup, MQTT listener lifecycle, ready/error events, messaging/thread/group operations, options, and cleanup. Method names alone do not prove compatibility: argument positions, callback conventions, event shapes, and stop/reconnect semantics matter.

OmegA requirement: use audited GoatBot call sites as the compatibility source of truth. Keep unsupported methods explicit until implemented; do not return dummy values.

## OmegA-FCA implementation sequence

1. Native session/auth engine: independent account-scoped HTTP session, credential login, explicit challenge state and owner-only continuation; retain AppState/cookie login as separate paths.
2. Session bootstrap: authenticated identity, token extraction/refresh, checkpoint/logout detection, secure persistence opt-in, and cleanup.
3. Realtime engine: independently implemented MQTT/WebSocket lifecycle, readiness/sync state, cursor handling, decoder, normalized events, reconnect and listener teardown.
4. Action engine: implement and test methods required by GoatBot first, then expand the documented FCA surface.
5. Compatibility facade: match callback and promise contracts, ready/error events, stopListening, options and account switching.
6. Verification: deterministic sanitized fixtures, full Node 20+ test/syntax suite, then opt-in tests against an account the owner controls. Verify login, manual challenge, ready, receive/send, reconnect, logout and checkpoint reporting before calling it production-ready.

## Evidence and release rules

- The inspected reference source is historical implementation evidence, not a current Facebook protocol specification.
- Its observed routes, form fields, MQTT topics, packet fields, and event payloads must not be copied as assumed-current facts.
- No endpoint, GraphQL document identifier, MQTT topic, payload field, or challenge form is accepted into the native engine without current, repeatable evidence and tests.
- Never bypass checkpoint, 2FA, login approvals, rate limits, or other platform security controls.
- Never store live credentials, cookies, AppState, 2FA codes/seeds, or session tokens in source, fixtures, logs, or CI.
- Do not switch GoatBot's production dependency, merge branches, or deploy until release gates in PROTOCOL-EVIDENCE.md and the GoatBot integration audit pass.