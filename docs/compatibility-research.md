# Compatibility Research Notes

This document records an API/behavioral compatibility target from the publicly documented `@eryxenx/fca` package README and npm API reference. It is a requirements map only: no source code, implementation, binary, or runtime dependency is taken from that package.

## Security review

- Do not install or execute the reference package as part of OmegA-FCA development.
- A public security report flags credential-exfiltration behavior in certain historical package versions. Treat the package and all versions as untrusted; never provide it with Facebook passwords, 2FA secrets, cookies, or AppState.
- OmegA-FCA authentication must send credentials only to the intended Facebook endpoints after protocol review. No third-party credential relay, telemetry, or remote login helper.
- Build tests with synthetic fixtures and sanitized protocol observations only.

## Compatibility surface to implement independently

### Login and lifecycle
- Callback-style login compatible with the existing GoatBot expectation.
- AppState/cookie session input.
- Email/password login only if a safe, independently verified Facebook flow is available.
- Explicit manual 2FA/checkpoint outcomes; no security bypass.
- Options documented by the reference include `selfListen`, `listenEvents`, `listenTyping`, `updatePresence`, `autoMarkDelivery`, `autoMarkRead`, `autoReconnect`, `online`, `emitReady`, `proxy`, and `userAgent`.

### Messaging
- `sendMessage`, including body, attachment, mentions, sticker, and location payloads.
- `editMessage`, `unsendMessage`, `deleteMessage`, `getMessage`, `forwardAttachment`, and `uploadAttachment`.
- Read/delivery receipts and typing indicator methods.
- Media helpers and link/contact sharing are later compatibility targets.

### Events and connection
- `listen` / `listenMqtt` callback contract.
- Stable reconnect with bounded backoff and jitter, subscription readiness, stale-client guard, and one active listener.
- Normalize incoming message, thread, typing, presence, and receipt events into documented event shapes.
- Preserve event ordering per thread and suppress bounded duplicate deliveries.

### Threads, groups, users, and social
- Thread info/list/history, create/delete/mute/archive, and search.
- Title/color/emoji/nickname/group image/admin/member operations.
- Poll and pin operations.
- User info/ID lookup, friends, profile, and friend-request/block/follow operations.
- Post/comment reactions, comments, and share operations.

### Session safety
- Persist only encrypted session material.
- Atomic writes, backup/restore, corruption checks, and secret redaction.
- Reuse valid sessions; do not force relogin on ordinary process restarts.
- Detect logged-out/checkpoint/transient/unknown states without treating transient failures as logout.

## Independent update system

- Publish versioned releases and a signed update manifest from an OmegA-controlled endpoint.
- Verify manifest signature, package digest, supported runtime, and release channel before applying.
- Support stable/beta channels, changelog display, staged rollout, backup, health check, and rollback.
- Auto-update must be configurable; never update while a live session is mid-operation.
- Never execute unsigned remote scripts or fetch update code from the reference package.

## Implementation status

This is a research checklist, not a claim that these APIs or Facebook protocol flows are already implemented. Actual authentication, MQTT framing/subscription, event decoding, and endpoint behavior must be independently verified before being marked complete.
