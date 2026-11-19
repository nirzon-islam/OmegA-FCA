# Official Meta Messenger transport

This transport is for a Facebook Page connected to the official Meta Messenger Platform. It is intentionally separate from the personal-account FCA/AppState interface.

## Requirements

- A Meta app configured for Messenger Platform and a Facebook Page.
- A Page access token with the permissions required by your app and recipient.
- A supported Graph API version configured explicitly.
- A public HTTPS webhook endpoint subscribed to the Page's Messenger events.
- The app secret for verifying `X-Hub-Signature-256`.

Meta's official Messenger Platform is Page-based. It does not provide the personal-account API surface exposed by unofficial FCA packages. This provider does not emulate browser sessions and does not use MQTT.

## Outbound messages

```js
const { createMetaMessengerTransport } = require("@omega/fca");

const transport = createMetaMessengerTransport({
  pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN,
  pageId: process.env.META_PAGE_ID,
  apiVersion: process.env.META_GRAPH_API_VERSION,
  appSecret: process.env.META_APP_SECRET
});

const result = await transport.sendMessage("RECIPIENT_PSID", {
  text: "Hello from OmegA"
});

console.log(result.message_id);
```

The Page token is sent as an Authorization Bearer header and is never added to the request URL. Send requests are not automatically retried, avoiding accidental duplicate message sends.

## Inbound webhook events

The host application owns the HTTPS server and Meta webhook subscription. Preserve the exact raw request bytes before parsing JSON, then pass both parsed payload and raw bytes to `publishWebhook`. The provider verifies the HMAC-SHA256 signature over the original bytes, parses JSON from those same verified bytes, and only then emits normalized events. Webhook bodies are limited to 1 MiB.

```js
const rawBody = Buffer.from(requestBodyBytes);
const signature = request.headers["x-hub-signature-256"];

transport.listen((error, event) => {
  if (error) return console.error(error);
  console.log(event.type, event.senderID, event);
});

transport.publishWebhook(rawBody, signature);
```

Do not parse and re-serialize the body before signature verification: the signature is calculated over the original bytes. Reject webhook requests that fail verification. For the GET verification handshake, use the exported `verifyWebhookChallenge(query, verifyToken)` helper; it returns the challenge string only when `hub.mode=subscribe` and the verify token matches, otherwise `null`. Configure the HTTPS endpoint in your application; this package does not create or expose a web server.

Normalized event types currently include `message`, `postback`, `delivery`, `read`, `account_linking`, and `referral`.

## Lifecycle and limitations

Call `await transport.disconnect()` when the host application shuts down. `getCapabilities()` explicitly reports `userSessionEmulation: false` and `mqtt: false`.

This provider does not implement personal-profile inbox access, AppState login, private browser endpoints, group-chat administration, or the legacy GoatBot FCA API. Those capabilities must not be inferred from the shared method names.
