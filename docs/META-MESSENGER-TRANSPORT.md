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

The Page token is sent as an Authorization Bearer header and is never added to the request URL. Send requests are not automatically retried, avoiding accidental duplicate actions. `sendTypingIndicator(recipientId, typing = true)` maps to Meta sender actions `typing_on` / `typing_off`, and `markAsRead(recipientId)` maps to `mark_seen`. The transport also exposes `getThreadList(limit, after)`, `getThreadInfo(conversationId)`, `getThreadHistory(conversationId, limit, after)`, and `getMessage(messageId)` through the official Page Conversations and Conversation Messages Graph API edges. These read operations require the Page permissions documented by Meta and return Graph API data/pagination objects rather than pretending to provide the legacy personal-account FCA response shape.

## Inbound webhook events

The host application owns the HTTPS server and Meta webhook subscription. Preserve the exact raw request bytes before parsing JSON, then pass the raw bytes and `X-Hub-Signature-256` value to `publishWebhook`. The provider verifies the HMAC-SHA256 signature over the original bytes, parses JSON from those same verified bytes, and only then emits normalized events for the configured Page ID. Events for other Page IDs are ignored. Webhook bodies are limited to 1 MiB.

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

## Runnable webhook server example

A built-in Node.js HTTP server example is available at `examples/meta-messenger-server.js`. It handles the GET challenge, enforces a 1 MiB POST body limit, verifies the signature against the original request bytes, and returns a generic error body on invalid requests. Put it behind a trusted HTTPS ingress and do not expose the plain HTTP listener directly to the public internet.

Run it with:

```bash
node examples/meta-messenger-server.js
```

## Lifecycle and limitations

Call `await transport.disconnect()` when the host application shuts down. `getCapabilities()` explicitly reports `userSessionEmulation: false` and `mqtt: false`.

This provider does not implement personal-profile inbox access, AppState login, private browser endpoints, group-chat administration, or the legacy GoatBot FCA API. Those capabilities must not be inferred from the shared method names.


## Conversation read permissions

For Messenger Page conversations, Meta documents the Page access token and the `pages_manage_metadata`, `pages_read_engagement`, and `pages_messaging` permissions. The transport does not attempt to grant permissions or bypass App Review. See the [Page Conversations reference](https://developers.facebook.com/docs/graph-api/reference/page/conversations) and [Conversation Messages reference](https://developers.facebook.com/docs/graph-api/reference/conversation/messages/).
