"use strict";

// Minimal built-in Node.js HTTPS reverse-proxy target for Meta Messenger webhooks.
// Terminate TLS at your trusted ingress/proxy and forward only over a private network.

const http = require("node:http");
const {
  createMetaMessengerTransport,
  verifyWebhookChallenge
} = require("../index");

const required = [
  "META_PAGE_ACCESS_TOKEN",
  "META_PAGE_ID",
  "META_GRAPH_API_VERSION",
  "META_APP_SECRET",
  "META_WEBHOOK_VERIFY_TOKEN"
];
for (const name of required) {
  if (!process.env[name]) throw new Error("Missing required environment variable: " + name);
}

const transport = createMetaMessengerTransport({
  pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN,
  pageId: process.env.META_PAGE_ID,
  apiVersion: process.env.META_GRAPH_API_VERSION,
  appSecret: process.env.META_APP_SECRET
});

transport.listen((error, event) => {
  if (error) {
    console.error("Messenger event listener failed:", error.message);
    return;
  }
  console.log("Messenger event:", event.type, "from", event.senderID || "unknown");
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/webhook") {
    response.writeHead(404).end("Not found");
    return;
  }

  if (request.method === "GET") {
    const challenge = verifyWebhookChallenge(
      Object.fromEntries(url.searchParams),
      process.env.META_WEBHOOK_VERIFY_TOKEN
    );
    if (challenge === null) {
      response.writeHead(403).end("Webhook verification failed");
      return;
    }
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(challenge);
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, { allow: "GET, POST" }).end("Method not allowed");
    return;
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 1024 * 1024) {
        response.writeHead(413).end("Payload too large");
        return;
      }
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks, size);
    const count = transport.publishWebhook(rawBody, request.headers["x-hub-signature-256"]);
    response.writeHead(200, { "content-type": "text/plain" }).end("EVENT_RECEIVED");
    if (count === 0) console.info("Received a valid webhook with no supported event entries");
  } catch (error) {
    const status = error.code === "META_WEBHOOK_SIGNATURE_INVALID" ? 401 : 400;
    response.writeHead(status, { "content-type": "text/plain" }).end("Invalid webhook");
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log("OmegA Messenger webhook listening on", port));

async function shutdown() {
  server.close();
  await transport.disconnect();
}
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
