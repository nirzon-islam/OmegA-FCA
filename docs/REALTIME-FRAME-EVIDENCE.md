# Realtime frame evidence

## What the Android capture establishes

The user-provided Messenger Web DevTools screenshots show a successful WebSocket handshake for the gateway.messenger.com /ws/realtime endpoint (HTTP 200) and binary frames in its Messages panel. A selected frame's hex/ASCII view visibly contains a JSON-like object with an events array and event objects containing name and args fields.

## What it does not establish

The screenshots do not provide a complete, sanitized frame corpus, a reliable mapping of event names to semantics, the binary prefix/length encoding, subscription/acknowledgement rules, reconnect behavior, send-command format, authentication requirements, or message encryption/decryption. No raw frame payloads, cookies, authorization headers, or tokens have been committed.

## Decoder scope

src/transport/realtimeFrameDecoder.js implements only the evidence-backed portion: bounded extraction of a JSON object containing an events array whose entries have string name fields. The binary prefix is intentionally opaque. summarizeRealtimeFrame returns event names and counts without payload values, suitable for safe diagnostics.

This is a frame-inspection primitive, not a working Messenger transport. It does not connect to Facebook, authenticate, subscribe, acknowledge frames, send messages, or decode E2EE content. Do not infer event semantics from names alone.
