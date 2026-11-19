"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const {
  createMetaMessengerTransport,
  normalizeWebhookPayload,
  verifyWebhookSignature
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
  assert.match(requestUrl, /^https:\/\/graph\.facebook\.com\/vXX\.X\/me\/messages$/);
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
    () => transport.publishWebhook({ object: "page", entry: [] }, Buffer.from('{"object":"page"}'), "sha256=" + "0".repeat(64)),
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
  assert.equal(transport.publishWebhook(JSON.parse(raw.toString()), raw, signature), 1);
  assert.equal(received[0].error, null);
  assert.equal(received[0].event.messageID, "mid.2");
  detach();
  transport.disconnect();
});
