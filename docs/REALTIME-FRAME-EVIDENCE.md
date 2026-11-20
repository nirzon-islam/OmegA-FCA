# Realtime frame evidence

## What the Android capture establishes

The user-provided Messenger Web DevTools screenshots show a successful WebSocket handshake for the gateway.messenger.com /ws/realtime endpoint (HTTP 200) and binary frames in its Messages panel. A selected frame's hex/ASCII view visibly contains a JSON-like object with an events array and event objects containing name and args fields.

## What it does not establish

The screenshots do not provide a complete, sanitized frame corpus, a reliable mapping of event names to semantics, the binary prefix/length encoding, subscription/acknowledgement rules, reconnect behavior, send-command format, authentication requirements, or message encryption/decryption. No raw frame payloads, cookies, authorization headers, or tokens have been committed.

## Decoder scope

src/transport/realtimeFrameDecoder.js implements only the evidence-backed portion: bounded extraction of a JSON object containing an events array whose entries have string name fields. The binary prefix is intentionally opaque. summarizeRealtimeFrame returns event names and counts without payload values, suitable for safe diagnostics.

This is a frame-inspection primitive, not a working Messenger transport. It does not connect to Facebook, authenticate, subscribe, acknowledge frames, send messages, or decode E2EE content. Do not infer event semantics from names alone.


## Additional owner-provided outgoing frame sample (2026-11-20)

A later DevTools capture supplied four outgoing binary frames and one one-byte incoming frame. The outgoing frame bodies contain a small binary prefix followed by an outer JSON envelope with an `app_id`, a JSON-encoded `payload` string, `request_id`, and `type`. The payload string itself contains synchronization metadata.

Observed payload fields across the supplied samples:

- One request used a `trq` queue name, label `145`, and a batch of task identifiers (approximately 172–187 in the inspected sample). This is evidence of a queue/task request shape only; task semantics are unknown.
- Three subsequent request envelopes carried `database` values `1`, `2`, and `16`, with request IDs `6`, `7`, and `8` respectively. They also carried `epoch_id`, `failure_count: null`, `last_applied_cursor`, `sync_params`, and `version` fields.
- The sample for database `2` and database `16` had `sync_params.locale = "en_GB"` and a null `last_applied_cursor`; the database `1` sample included a non-null cursor and null `sync_params`.
- The only supplied incoming frame was a single byte `0A`. With no surrounding exchange or schema, it cannot be assigned a reliable acknowledgement, error, or control meaning.

These observations add a synchronization-request shape to the evidence register, but they do **not** establish the binary prefix grammar, the meaning of database numbers, epoch/cursor lifecycle, task semantics, response correlation, acknowledgement rules, authentication, subscription setup, or action encoding. The sample is not sufficient to implement a working Facebook realtime client. Raw frames and cursor values are intentionally not stored in this repository.

## Implementation consequence

Do not add a speculative decoder or claim a native socket is ready from this sample. The next protocol milestone requires a sanitized, paired request/response capture covering connection setup, sync response bodies, task completion/acknowledgement, event delivery, and a benign owner-triggered action, with sensitive identifiers and message contents removed. Keep the existing envelope inspector bounded and prefix-agnostic until the framing grammar is independently verified.
