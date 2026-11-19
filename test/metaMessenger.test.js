"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const {
  createMetaMessengerTransport,
  normalizeWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookChallenge
} = require("../src/transport/metaMessenger");

const config = {
  pageAccessToken: "synthetic-page-token",
  pageId: "123456789012345",
  apiVersion: "v99.0",
  appSecret: "synthetic-app-secret"
};

test("Meta webhook normalization maps messages and delivery events", () => {
  const events = normalizeWebhookPayload({
    object: "page",
    entry: [{
      id: "123456789012345",
      messaging: [
        { sender: { id: "987654321098765" }, recipient: { id: "123456789012345" }, timestamp: 1700000000000, message: { mid: "mid.1", text: "hello" } },
        { sender: { id: "987654321098765" }, recipient: { id: "123456789012345" }, delivery: { mids: ["mid.1"], watermark: 1700000000001 } }
      ]
    }]
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "message");
  assert.equal(events[0].senderID, "987654321098765");
  assert.equal(events[0].text, "hello");
  assert.equal(events[1].type, "delivery");
  assert.deepEqual(events[1].mids, ["mid.1"]);
});

test("Meta webhook signature verification uses raw bytes and timing-safe comparison", () => {
  const raw = Buffer.from('{"object":"page"}');
  const signature = "sha256=" + createHmac("sha256", config.appSecret).update(raw).digest("hex");
  assert.equal(verifyWebhookSignature(raw, signature, config.appSecret), true);
  assert.equal(verifyWebhookSignature(raw, signature, "wrong-secret"), false);
  assert.equal(verifyWebhookSignature(Buffer.from("different"), signature, config.appSecret), false);
  assert.equal(verifyWebhookSignature(raw, "sha1=bad", config.appSecret), false);
});

test("official Meta transport sends through Graph API without putting token in URL", async () => {
  let requestUrl;
  let requestOptions;
  const transport = createMetaMessengerTransport({
    ...config,
    fetchImpl: async (url, options) => {
      requestUrl = String(url);
      requestOptions = options;
      return new Response(JSON.stringify({ message_id: "mid.123", recipient_id: "987654321098765" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });
  const result = await transport.sendMessage("987654321098765", { text: "hello" });
  assert.equal(result.message_id, "mid.123");
  assert.match(requestUrl, /^https:\/\/graph\.facebook\.com\/v99\.0\/me\/messages$/);
  assert.equal(requestUrl.includes(config.pageAccessToken), false);
  assert.equal(requestOptions.headers.authorization, "Bearer " + config.pageAccessToken);
  assert.equal(JSON.parse(requestOptions.body).message.text, "hello");
  assert.equal(transport.getCapabilities().mqtt, false);
  await transport.disconnect();
  await assert.rejects(transport.sendMessage("987654321098765", { text: "again" }), /disconnected/);
});

test("official Meta transport refuses unsigned webhook events", () => {
  const transport = createMetaMessengerTransport(config);
  assert.throws(
    () => transport.publishWebhook(Buffer.from('{"object":"page"}'), "sha256=" + "0".repeat(64)),
    { code: "META_WEBHOOK_SIGNATURE_INVALID" }
  );
});

test("official Meta transport delivers only verified webhook events to listeners", () => {
  const raw = Buffer.from(JSON.stringify({
    object: "page",
    entry: [{ id: config.pageId, messaging: [{ sender: { id: "987654321098765" }, message: { mid: "mid.2", text: "hi" } }] }]
  }));
  const signature = "sha256=" + createHmac("sha256", config.appSecret).update(raw).digest("hex");
  const transport = createMetaMessengerTransport(config);
  const received = [];
  const detach = transport.listen((error, event) => received.push({ error, event }));
  assert.equal(transport.publishWebhook(raw, signature), 1);
  assert.equal(received[0].error, null);
  assert.equal(received[0].event.messageID, "mid.2");
  detach();
  transport.disconnect();
});


test("Meta transport parses only the raw bytes covered by the webhook signature", () => {
  const raw = Buffer.from(JSON.stringify({
    object: "page",
    entry: [{ id: config.pageId, messaging: [{ sender: { id: "987654321098765" }, message: { mid: "signed-mid", text: "signed" } }] }]
  }));
  const signature = "sha256=" + createHmac("sha256", config.appSecret).update(raw).digest("hex");
  const transport = createMetaMessengerTransport(config);
  const received = [];
  transport.listen((error, event) => received.push(event));
  assert.equal(transport.publishWebhook(raw, signature), 1);
  assert.equal(received[0].messageID, "signed-mid");
  assert.equal(received[0].text, "signed");
  transport.disconnect();
});


test("Meta webhook challenge requires subscribe mode and timing-safe token match", () => {
  const query = {
    "hub.mode": "subscribe",
    "hub.verify_token": "synthetic-verify-token",
    "hub.challenge": "challenge-123"
  };
  assert.equal(verifyWebhookChallenge(query, "synthetic-verify-token"), "challenge-123");
  assert.equal(verifyWebhookChallenge(query, "wrong-token"), null);
  assert.equal(verifyWebhookChallenge({ ...query, "hub.mode": "unsubscribe" }, "synthetic-verify-token"), null);
});


test("Meta Send API errors are surfaced without retrying unsafe message sends", async () => {
  let calls = 0;
  const transport = createMetaMessengerTransport({
    ...config,
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ error: { message: "Recipient unavailable", code: 10, fbtrace_id: "trace-1" } }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
  });
  await assert.rejects(
    transport.sendMessage("987654321098765", { text: "hello" }),
    error => error.status === 400 && error.code === "META_GRAPH_10" && error.fbtraceId === "trace-1"
  );
  assert.equal(calls, 1);
  await transport.disconnect();
});

test("webhook ingestion requires an app secret even for a well-formed body", () => {
  const transport = createMetaMessengerTransport({
    pageAccessToken: config.pageAccessToken,
    pageId: config.pageId,
    apiVersion: config.apiVersion
  });
  assert.throws(
    () => transport.publishWebhook(Buffer.from('{"object":"page","entry":[]}'), "sha256=" + "0".repeat(64)),
    /appSecret is required/
  );
  transport.disconnect();
});


test("webhook delivery isolates application callback exceptions", () => {
  const raw = Buffer.from(JSON.stringify({
    object: "page",
    entry: [{ id: config.pageId, messaging: [{ sender: { id: "987654321098765" }, message: { mid: "callback-mid", text: "hi" } }] }]
  }));
  const signature = "sha256=" + createHmac("sha256", config.appSecret).update(raw).digest("hex");
  const transport = createMetaMessengerTransport(config);
  let received = 0;
  transport.listen(() => { throw new Error("synthetic handler failure"); });
  transport.listen(() => { received++; });
  assert.equal(transport.publishWebhook(raw, signature), 1);
  assert.equal(received, 1);
  transport.disconnect();
});


test("webhook accepts Uint8Array bytes and ignores events for other Pages", () => {
  const payload = {
    object: "page",
    entry: [
      { id: config.pageId, messaging: [{ sender: { id: "987654321098765" }, message: { mid: "ours", text: "ours" } }] },
      { id: "999999999999999", messaging: [{ sender: { id: "987654321098765" }, message: { mid: "other", text: "other" } }] }
    ]
  };
  const raw = new Uint8Array(Buffer.from(JSON.stringify(payload)));
  const signature = "sha256=" + createHmac("sha256", config.appSecret).update(Buffer.from(raw)).digest("hex");
  const transport = createMetaMessengerTransport(config);
  const received = [];
  transport.listen((_error, event) => received.push(event));
  assert.equal(transport.publishWebhook(raw, signature), 1);
  assert.equal(received.length, 1);
  assert.equal(received[0].pageID, config.pageId);
  assert.equal(received[0].messageID, "ours");
  transport.disconnect();
});

test("webhook rejects non-byte payload values and bodies over one MiB", () => {
  const transport = createMetaMessengerTransport(config);
  assert.throws(() => transport.publishWebhook("not bytes", "sha256=" + "0".repeat(64)), {
    code: "META_WEBHOOK_SIGNATURE_INVALID"
  });
  assert.throws(() => transport.publishWebhook(new Uint8Array(1024 * 1024 + 1), "sha256=" + "0".repeat(64)), {
    code: "META_WEBHOOK_SIGNATURE_INVALID"
  });
  transport.disconnect();
});


test("Meta transport exposes official typing and read sender actions without retrying", async () => {
  const calls = [];
  const transport = createMetaMessengerTransport({
    ...config,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ recipient_id: "987654321098765" }), { status: 200 });
    }
  });
  await transport.sendTypingIndicator("987654321098765");
  await transport.sendTypingIndicator("987654321098765", false);
  await transport.markAsRead("987654321098765");
  assert.deepEqual(calls.map(call => JSON.parse(call.options.body).sender_action), [
    "typing_on", "typing_off", "mark_seen"
  ]);
  assert.ok(calls.every(call => call.options.method === "POST"));
  assert.ok(calls.every(call => !Object.hasOwn(call.options, "retryable")));
  assert.equal(calls.length, 3);
  await assert.rejects(transport.sendTypingIndicator("987654321098765", "yes"), /boolean/);
  await assert.rejects(transport.markAsRead("bad-id"), /recipient ID/);
  await transport.disconnect();
});


test("Meta Page transport reads conversations and messages with bounded pagination", async () => {
  const requests = [];
  const transport = createMetaMessengerTransport({
    ...config,
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(String(url)), options });
      return new Response(JSON.stringify({ data: [{ id: "123456789" }], paging: { cursors: { after: "cursor-next" } } }), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }
  });
  await transport.getThreadList(10, "cursor-1");
  await transport.getThreadInfo("123456789");
  await transport.getThreadHistory("123456789", 5, "cursor-2");
  await transport.getMessage("mid.123456");
  assert.equal(requests[0].url.pathname, "/v99.0/123456789012345/conversations");
  assert.equal(requests[0].url.searchParams.get("fields"), "id,updated_time,participants,unread_count");
  assert.equal(requests[0].url.searchParams.get("limit"), "10");
  assert.equal(requests[0].url.searchParams.get("after"), "cursor-1");
  assert.equal(requests[1].url.pathname, "/v99.0/123456789");
  assert.equal(requests[2].url.pathname, "/v99.0/123456789/messages");
  assert.equal(requests[2].url.searchParams.get("limit"), "5");
  assert.equal(requests[3].url.pathname, "/v99.0/mid.123456");
  assert.ok(requests.every(item => item.options.headers.authorization === "Bearer " + config.pageAccessToken));
  assert.ok(requests.every(item => !item.url.searchParams.has("access_token")));
  assert.throws(() => transport.getThreadList(101), /between 1 and 100/);
  assert.throws(() => transport.getThreadHistory("bad/id"), /conversation ID/);
  await transport.disconnect();
});

test("Meta Page reads surface Graph API permission errors", async () => {
  const transport = createMetaMessengerTransport({
    ...config,
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: "Permissions error", code: 200, fbtrace_id: "trace-read" }
    }), { status: 403, headers: { "content-type": "application/json" } })
  });
  await assert.rejects(
    transport.getThreadList(),
    error => error.status === 403 && error.code === "META_GRAPH_200" && error.fbtraceId === "trace-read"
  );
  await transport.disconnect();
});


test("Meta Page profile reads validate PSIDs and requested fields", async () => {
  let requestUrl;
  let requestOptions;
  const transport = createMetaMessengerTransport({
    ...config,
    fetchImpl: async (url, options) => {
      requestUrl = new URL(String(url));
      requestOptions = options;
      return new Response(JSON.stringify({
        id: "987654321098765", first_name: "Test", last_name: "User", profile_pic: "https://example.test/profile.jpg"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const profile = await transport.getUserInfo("987654321098765");
  assert.equal(profile.first_name, "Test");
  assert.equal(requestUrl.pathname, "/v99.0/987654321098765");
  assert.equal(requestUrl.searchParams.get("fields"), "first_name,last_name,profile_pic");
  assert.equal(requestOptions.headers.authorization, "Bearer " + config.pageAccessToken);
  assert.throws(() => transport.getUserInfo("bad/id"), /recipient ID/);
  assert.throws(() => transport.getUserInfo("987654321098765", ["email"]), /supported Messenger profile fields/);
  await transport.disconnect();
});
