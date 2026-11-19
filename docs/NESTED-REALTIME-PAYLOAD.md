# Nested realtime payload inspection

Some observed Messenger WebSocket frames contain an outer JSON envelope with a
Base64 string in `payload`. This helper decodes only that Base64 layer and
reports bounded structural metadata.

When the decoded bytes form a valid Protocol Buffers wire-compatible stream,
the summary reports field numbers, wire types, and length-delimited byte counts.
It never returns field values, strings, IDs, message contents, or raw bytes.
A successful structural scan does **not** prove that the payload uses a
particular .proto schema or identify its semantic meaning. Unknown payloads
remain classified as opaque binary.

This is a diagnostic primitive only. It does not authenticate, connect,
subscribe, acknowledge, send, decrypt, or map Messenger events. Raw captures
and account/session identifiers must not be committed.
