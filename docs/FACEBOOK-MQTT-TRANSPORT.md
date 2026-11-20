# Facebook Messenger MQTT transport (experimental)

This module is based on publicly available FCA implementation observations, not an official Meta personal-account API. Meta does not publish a supported personal Messenger API.

## Implemented

- WebSocket endpoint construction for `wss://edge-chat.facebook.com/chat`, with optional region, session ID and client/device ID.
- Browser-origin and owner-supplied cookie headers.
- MQTT 3.1 (`MQIsdp`, protocol version 3) CONNECT, CONNACK validation and the public FCA username metadata shape.
- The observed topic subscription family and QoS 1 SUBACK validation.
- Initial queue bootstrap via `/messenger_sync_create_queue`, or `/messenger_sync_get_diffs` when a caller supplies a sync token and sequence ID.
- QoS 1 PUBACK for inbound PUBLISH frames, outbound topic publish frames, and MQTT PINGREQ keepalive.
- Bounded `/ls_req` request publishing with numeric `request_id` allocation and `/ls_resp` correlation, timeout, pending-request cap and disconnect cleanup.
- Source-observed text/sticker/reply send task envelope builder (`createMessengerSendMessageRequest`) exposed through the native driver's `sendMessage()` method and bounded `/ls_req`–`/ls_resp` correlation. This is experimental and does not claim broker acceptance or delivery.
- Defensive `/t_ms` delta parsing for known message, reply, reaction, unsend, typing, read, presence and thread-event classes; unknown classes remain marked as `unknown_delta`.
- Conservative extraction of sync token / sequence cursor fields as `sync_cursor` events; when an account-bound `syncCursorStore` is explicitly supplied, cursors are AES-256-GCM encrypted at rest and reloaded on reconnect.
- Bounded WebSocket connection and protocol setup timeouts through the shared native realtime runtime.

## Example

The package deliberately does not add a WebSocket dependency. Supply a compatible implementation such as `ws` from your application:

```js
const WebSocket = require("ws");
const {
  createFacebookMqttProtocol,
  createNativeRealtimeTransport
} = require("@omega/fca");

const config = createFacebookMqttProtocol({
  userId: "YOUR_NUMERIC_USER_ID",
  cookie: process.env.FB_COOKIE
});

const transport = createNativeRealtimeTransport({
  url: config.url,
  headers: config.headers,
  protocol: config.protocol,
  socketFactory: ({ url, headers }) => new WebSocket(url, { headers })
});

const driver = await transport.connect();
driver.listen((error, event) => {
  if (error) console.error(error.message);
  else if (event?.type === "mqtt_publish") {
    console.log("MQTT topic:", event.topic);
  }
});
```

Do not log cookies or raw private message payloads. Store the AppState/cookie only in a private secret store or local environment variable; never commit it.

## Still required before calling this a complete FCA

- Decode Messenger sync queue responses and persist the latest sync token / sequence cursor.
- Validate delta field mappings against authorized live frames; current normalization is based on known public FCA shapes and preserves each raw delta for future mapping.
- Recover gaps after disconnect/restart using validated sync cursor handling.
- Implement source-verified Messenger task payload builders for send message, typing, read receipts and other FCA methods; the generic request correlation layer is now present but does not invent task schemas.
- Verify the handshake, queue bootstrap, receive and send behavior against an authorized live account, then test reconnect/long-running stability.

The endpoint, MQTT 3.1 metadata and topic/queue shapes are unofficial observations from public FCA source code and may change without notice. The implementation does not bypass Facebook checkpoints, 2FA or rate limits. The official Meta Page API remains a separate provider.
