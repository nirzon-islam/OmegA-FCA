"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createFacebookWebClient, assertFacebookUrl, toFormBody } = require("../src/auth/facebookWebClient");

function fakeResponse({ status = 200, body = '{"ok":true}', contentType = "application/json" } = {}) {
  return {
    status,
    headers: { get(name) { return name.toLowerCase() === "content-type" ? contentType : null; } },
    async text() { return body; }
  };
}

test("builds authenticated POST form with available session tokens", async () => {
  let request;
  const session = {
    userId: "123456789",
    getTokens: () => ({ fbDtsg: "dtsg", lsd: "lsd", jazoest: "22000", hsi: null, spinR: null, spinB: null, spinT: null }),
    getCookieHeader: () => "c_user=123456789",
    request: async (url, options) => {
      request = { url, options };
      return fakeResponse();
    }
  };
  const client = createFacebookWebClient({ session });
  const result = await client.post("https://www.facebook.com/api/test/", { value: "hello", nested: { a: 1 } });
  assert.equal(result.payload.ok, true);
  assert.equal(request.options.method, "POST");
  assert.match(request.options.headers.get("content-type"), /application\/x-www-form-urlencoded/);
  const form = new URLSearchParams(request.options.body);
  assert.equal(form.get("value"), "hello");
  assert.equal(form.get("nested"), '{"a":1}');
  assert.equal(form.get("av"), "123456789");
  assert.equal(form.get("fb_dtsg"), "dtsg");
  assert.equal(form.get("lsd"), "lsd");
  assert.equal(form.get("jazoest"), "22000");
});

test("supports GET query params and normalizes Facebook error responses", async () => {
  let request;
  const session = {
    userId: "123456789",
    getTokens: () => ({}),
    getCookieHeader: () => "",
    request: async (url, options) => { request = { url, options }; return fakeResponse({ body: '{"error":{"message":"checkpoint_required"}}' }); }
  };
  const client = createFacebookWebClient({ session });
  await assert.rejects(client.get("https://www.facebook.com/api/test/", { query: { limit: 5 } }), error => error.code === "FCA_CHECKPOINT_REQUIRED");
  assert.equal(request.url.searchParams.get("limit"), "5");
  assert.equal(request.options.method, "GET");
});

test("rejects non-Facebook hosts, unsafe methods and invalid form keys", async () => {
  assert.throws(() => assertFacebookUrl("https://example.com/"), /Facebook\/Messenger/);
  assert.throws(() => assertFacebookUrl("http://www.facebook.com/"), /Facebook\/Messenger/);
  assert.throws(() => toFormBody({ "bad field": "x" }, {}, "1"), /field name is invalid/);
  const client = createFacebookWebClient({
    session: { userId: "1", getTokens: () => ({}), getCookieHeader: () => "", request: async () => fakeResponse() }
  });
  await assert.rejects(client.request("https://www.facebook.com/", { method: "DELETE" }), /GET, HEAD, and POST/);
});
