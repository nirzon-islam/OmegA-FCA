"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_GATEWAY_URL,
  FACEBOOK_GATEWAY_SUBSCRIPTIONS,
  encodeGatewaySubscription,
  decodeGatewayFrame,
  createFacebookGatewayProtocol
} = require("../src/transport/facebookGatewayProtocol");

test("builds the Facebook realtime gateway URL and safe upgrade headers", () => {
  const config = createFacebookGatewayProtocol({
    userId: "123456789",
    deviceId: "device_123",
    userAgent: "OmegA FCA test",
    cookie: "c_user=123456789; xs=redacted"
  });
  const url = new URL(config.url);
  assert.equal(url.origin + url.pathname, DEFAULT_GATEWAY_URL);
  assert.equal(url.searchParams.get("x-dgw-uuid"), "123456789");
  assert.equal(url.searchParams.get("x-dgw-deviceid"), "device_123");
  assert.equal(config.headers.Origin, "https://www.facebook.com");
  assert.equal(config.headers.Cookie, "c_user=123456789; xs=redacted");
  assert.equal(FACEBOOK_GATEWAY_SUBSCRIPTIONS.length, 8);
});

test("encodes gateway subscription frame with bounded two-byte body length", () => {
  const frame = encodeGatewaySubscription('{"method":"test"}', 2);
  assert.equal(frame[0], 14);
  assert.equal(frame[1], 2);
  assert.equal(frame[2], 0);
  assert.equal(frame[3], Buffer.byteLength('{"method":"test"}'));
  assert.equal(frame.subarray(4, -2).toString(), '{"method":"test"}');
  assert.deepEqual([...frame.subarray(-2)], [0, 0]);
  assert.throws(() => encodeGatewaySubscription("x".repeat(65536), 0), /two-byte length/);
  const large = encodeGatewaySubscription("x".repeat(300), 1);
  assert.equal(large[2], 1);
  assert.equal(large[3], 44);
  assert.equal(large.subarray(4, -2).length, 300);
});

test("decodes a gateway subscription response and notification payload", () => {
  const payload = {
    code: 200,
    data: { viewer: { notifications_page: { edges: [
      { node: {} },
      { node: { notif: {
        notif_id: "n1",
        body: { text: "hello" },
        tracking: { from_uids: { "987654321": true } },
        url: "https://www.facebook.com/",
        creation_time: { timestamp: 123 },
        seen_state: 0
      } } }
    ] } } }
  };
  const decoded = decodeGatewayFrame(Buffer.concat([
    Buffer.from([14, 0, 0, 0]),
    Buffer.from(JSON.stringify(payload))
  ]));
  assert.deepEqual(decoded.events.map(event => event.type), ["subscription_success", "notification"]);
  assert.equal(decoded.events[1].senderId, "987654321");
  assert.equal(decoded.events[1].body, "hello");
});

test("rejects malformed IDs, unsafe endpoints and cookie header injection", () => {
  assert.throws(() => createFacebookGatewayProtocol({ userId: "not-an-id" }), /numeric Facebook ID/);
  assert.throws(() => createFacebookGatewayProtocol({ userId: "123", url: "wss://evil.example/ws/realtime" }), /verified gateway/);
  assert.throws(() => createFacebookGatewayProtocol({ userId: "123", cookie: "a=b\r\nInjected: yes" }), /invalid characters/);
});

test("subscribes with numbered frames and does not pretend to support send actions", async () => {
  const config = createFacebookGatewayProtocol({ userId: "123456789" });
  const sent = [];
  await config.protocol.subscribe({ send: frame => sent.push(frame) });
  assert.equal(sent.length, FACEBOOK_GATEWAY_SUBSCRIPTIONS.length);
  assert.equal(sent[0][0], 14);
  assert.equal(sent[3].subarray(4, -2).toString().includes('"x-dgw-app-XRSS-actor_id":"123456789"'), true);
  await assert.rejects(config.protocol.encodeAction({ text: "hi" }), /does not support Messenger send actions/);
});
