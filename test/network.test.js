"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequestClient, retryAfterMs, isRetryableStatus } = require("../src/network/requestClient");
const { CookieJar } = require("../src/network/cookieJar");

function response(status, retryAfter = null) {
  return {
    status,
    headers: { get: name => name.toLowerCase() === "retry-after" ? retryAfter : null },
    body: { cancel: async () => {} }
  };
}

test("request client retries transient GET responses with bounded attempts", async () => {
  let calls = 0;
  const delays = [];
  const request = createRequestClient({
    fetchImpl: async () => (++calls < 3 ? response(503) : response(200)),
    maxAttempts: 3,
    baseDelayMs: 10,
    random: () => 0.5,
    sleep: async ms => delays.push(ms)
  });
  const result = await request("https://www.facebook.com/");
  assert.equal(result.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("request client does not retry non-idempotent POST by default", async () => {
  let calls = 0;
  const request = createRequestClient({
    fetchImpl: async () => { calls++; return response(503); },
    maxAttempts: 4,
    sleep: async () => {}
  });
  const result = await request("https://www.facebook.com/api", { method: "POST", body: "x" });
  assert.equal(result.status, 503);
  assert.equal(calls, 1);
});

test("request client requires HTTPS except localhost and validates attempts", async () => {
  assert.throws(() => createRequestClient({ maxAttempts: 0 }), /maxAttempts/);
  const request = createRequestClient({ fetchImpl: async () => response(200) });
  await assert.rejects(request("http://facebook.com/"), /HTTPS/);
  const local = await request("http://localhost:3000/health");
  assert.equal(local.status, 200);
});

test("request client honors Retry-After and does not retry timeout errors", async () => {
  let calls = 0;
  const delays = [];
  const request = createRequestClient({
    fetchImpl: async () => (++calls === 1 ? response(429, "2") : response(200)),
    maxAttempts: 3,
    sleep: async ms => delays.push(ms)
  });
  assert.equal((await request("https://www.facebook.com/")).status, 200);
  assert.deepEqual(delays, [2000]);
  const timeout = new Error("timeout");
  timeout.name = "TimeoutError";
  const failing = createRequestClient({ fetchImpl: async () => { throw timeout; }, maxAttempts: 3 });
  await assert.rejects(failing("https://www.facebook.com/"), /timeout/);
});

test("retry helpers classify statuses and HTTP dates", () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(retryAfterMs("2", 0), 2000);
  assert.equal(retryAfterMs("invalid", 0), null);
});

test("cookie jar respects domain, path, secure and expiry rules", () => {
  let now = 1_000_000;
  const jar = new CookieJar([
    { key: "root", value: "r", domain: "facebook.com", path: "/", hostOnly: false },
    { key: "path", value: "p", domain: "facebook.com", path: "/messages", hostOnly: false },
    { key: "secure", value: "s", domain: "facebook.com", path: "/", secure: true, hostOnly: false },
    { key: "expired", value: "x", domain: "facebook.com", path: "/", expires: 900, hostOnly: false },
    { key: "host", value: "h", domain: "www.facebook.com", path: "/", hostOnly: true }
  ], { now: () => now });
  assert.equal(
    jar.getCookieHeader("https://www.facebook.com/messages/123"),
    "path=p; root=r; secure=s; host=h"
  );
  assert.equal(
    jar.getCookieHeader("http://www.facebook.com/"),
    "root=r; host=h"
  );
  assert.equal(jar.getCookieHeader("https://m.facebook.com/"), "root=r; secure=s");
  now += 1;
  jar.clear();
  assert.equal(jar.size, 0);
});


test("request client strips its retry control before fetch and cancels retried bodies", async () => {
  let calls = 0;
  let cancelled = 0;
  let fetchOptions;
  const request = createRequestClient({
    fetchImpl: async (_url, options) => {
      fetchOptions = options;
      calls++;
      return calls === 1
        ? { ...response(503), body: { cancel: async () => { cancelled++; } } }
        : response(200);
    },
    maxAttempts: 2,
    baseDelayMs: 1,
    random: () => 0.5,
    sleep: async () => {}
  });

  const result = await request("https://www.facebook.com/", { retryable: true });
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.equal(cancelled, 1);
  assert.equal(Object.hasOwn(fetchOptions, "retryable"), false);
});

test("request client allows callers to disable retries for GET requests", async () => {
  let calls = 0;
  const request = createRequestClient({
    fetchImpl: async () => { calls++; return response(503); },
    maxAttempts: 3,
    sleep: async () => {}
  });
  const result = await request("https://www.facebook.com/", { retryable: false });
  assert.equal(result.status, 503);
  assert.equal(calls, 1);
});

test("request client rejects URL credentials and invalid timeout configuration", async () => {
  assert.throws(() => createRequestClient({ timeoutMs: 0 }), /timeoutMs/);
  const request = createRequestClient({ fetchImpl: async () => response(200) });
  await assert.rejects(request("https://user:pass@www.facebook.com/"), /credentials/);
});
