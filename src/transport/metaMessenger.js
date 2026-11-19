"use strict";

const { EventEmitter } = require("node:events");
const { createHmac, timingSafeEqual } = require("node:crypto");
const { createRequestClient } = require("../network/requestClient");

const GRAPH_HOST = "graph.facebook.com";

function verifyWebhookSignature(rawBody, signature, appSecret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" ||
      !/^sha256=[a-f0-9]{64}$/i.test(signature) ||
      typeof appSecret !== "string" || !appSecret) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const supplied = Buffer.from(signature.toLowerCase());
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function verifyWebhookChallenge(query, verifyToken) {
  if (!query || typeof query !== "object" || query["hub.mode"] !== "subscribe" ||
      typeof query["hub.verify_token"] !== "string" ||
      typeof query["hub.challenge"] !== "string" ||
      typeof verifyToken !== "string" || !verifyToken) return null;
  const supplied = Buffer.from(query["hub.verify_token"]);
  const expected = Buffer.from(verifyToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return query["hub.challenge"];
}

function normalizeWebhookPayload(payload) {
  if (!payload || payload.object !== "page" || !Array.isArray(payload.entry)) {
    throw new TypeError("Expected a Messenger Page webhook payload");
  }
  const events = [];
  for (const entry of payload.entry) {
    if (!entry || !Array.isArray(entry.messaging)) continue;
    for (const item of entry.messaging) {
      if (!item || typeof item !== "object") continue;
      const base = {
        object: "page",
        pageID: String(entry.id || ""),
        senderID: item.sender?.id == null ? null : String(item.sender.id),
        recipientID: item.recipient?.id == null ? null : String(item.recipient.id),
        timestamp: Number.isFinite(item.timestamp) ? item.timestamp : null
      };
      if (item.message) {
        events.push({
          ...base, type: "message",
          messageID: item.message.mid == null ? null : String(item.message.mid),
          text: typeof item.message.text === "string" ? item.message.text : null,
          attachments: Array.isArray(item.message.attachments) ? item.message.attachments : [],
          isEcho: Boolean(item.message.is_echo),
          replyTo: item.message.reply_to || null
        });
      } else if (item.postback) {
        events.push({ ...base, type: "postback", title: item.postback.title || null, payload: item.postback.payload || null });
      } else if (item.delivery) {
        events.push({ ...base, type: "delivery", mids: Array.isArray(item.delivery.mids) ? item.delivery.mids : [], watermark: item.delivery.watermark || null });
      } else if (item.read) {
        events.push({ ...base, type: "read", watermark: item.read.watermark || null });
      } else if (item.account_linking) {
        events.push({ ...base, type: "account_linking", status: item.account_linking.status || null, authorizationCode: item.account_linking.authorization_code || null });
      } else if (item.referral) {
        events.push({ ...base, type: "referral", referral: item.referral });
      }
    }
  }
  return events;
}

function createMetaMessengerTransport({
  pageAccessToken,
  pageId,
  apiVersion,
  appSecret,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000
} = {}) {
  if (typeof pageAccessToken !== "string" || !pageAccessToken.trim()) {
    throw new TypeError("A Page access token is required");
  }
  if (typeof pageId !== "string" || !/^\d{5,30}$/.test(pageId)) {
    throw new TypeError("A numeric Page ID is required");
  }
  if (typeof apiVersion !== "string" || !/^v\d+\.\d+$/.test(apiVersion)) {
    throw new TypeError("Set a supported Graph API version, for example vXX.X");
  }
  if (appSecret !== undefined && (typeof appSecret !== "string" || !appSecret)) {
    throw new TypeError("appSecret must be non-empty text when provided");
  }

  const request = createRequestClient({ fetchImpl, timeoutMs, maxAttempts: 2 });
  const events = new EventEmitter();
  let closed = false;

  async function sendMessage(recipientId, message) {
    if (closed) throw new Error("Messenger transport is disconnected");
    if (typeof recipientId !== "string" || !/^\d{5,30}$/.test(recipientId)) {
      throw new TypeError("A valid page-scoped recipient ID is required");
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new TypeError("Message must be a Messenger message object");
    }
    const url = new URL("https://" + GRAPH_HOST + "/" + apiVersion + "/me/messages");
    const response = await request(url, {
      method: "POST",
      retryable: false,
      headers: {
        authorization: "Bearer " + pageAccessToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ recipient: { id: recipientId }, message })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      const error = new Error(body?.error?.message || "Meta Messenger Send API request failed");
      error.code = body?.error?.code ? "META_GRAPH_" + body.error.code : "META_GRAPH_REQUEST_FAILED";
      error.status = response.status;
      error.fbtraceId = body?.error?.fbtrace_id || null;
      throw error;
    }
    return body;
  }

  function listen(callback) {
    if (closed) throw new Error("Messenger transport is disconnected");
    if (typeof callback !== "function") throw new TypeError("listener callback is required");
    const listener = event => callback(null, event);
    events.on("event", listener);
    return () => events.off("event", listener);
  }

  function publishWebhook(rawBody, signature) {
    if (closed) throw new Error("Messenger transport is disconnected");
    if (!appSecret) {
      throw new Error("appSecret is required to verify Messenger webhook signatures");
    }
    if (!Buffer.isBuffer(rawBody) || rawBody.length > 1024 * 1024 ||
        !verifyWebhookSignature(rawBody, signature, appSecret)) {
      const error = new Error("Messenger webhook signature verification failed");
      error.code = "META_WEBHOOK_SIGNATURE_INVALID";
      throw error;
    }
    let payload;
    try { payload = JSON.parse(rawBody.toString("utf8")); }
    catch {
      const error = new Error("Messenger webhook body is not valid JSON");
      error.code = "META_WEBHOOK_PAYLOAD_INVALID";
      throw error;
    }
    const normalized = normalizeWebhookPayload(payload);
    for (const event of normalized) events.emit("event", event);
    return normalized.length;
  }

  async function disconnect() {
    if (closed) return;
    closed = true;
    events.removeAllListeners();
  }

  return Object.freeze({
    getCurrentUserID: () => pageId,
    sendMessage,
    listen,
    publishWebhook,
    disconnect,
    getCapabilities: () => Object.freeze({
      authentication: "page-access-token",
      inbound: "verified-webhook",
      outbound: "messenger-send-api",
      userSessionEmulation: false,
      mqtt: false
    })
  });
}

module.exports = { createMetaMessengerTransport, normalizeWebhookPayload, verifyWebhookSignature, verifyWebhookChallenge };
