"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequestClient, retryAfterMs, isRetryableStatus } = require("../src/network/requestClient");

test("parses Retry-After seconds and dates with a safe cap", () => {
  assert.equal(retryAfterMs("2", 0), 2000);
  assert.equal(retryAfterMs("invalid", 0), null);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(403), false);
});

test("retries safe GET requests on 429 then succeeds", async () => {
  let attempts = 0;
  const delays = [];
  const request = createRequestClient({
    fetchImpl: async () => {
      attempts++;
      return attempts === 1
        ? { status: 429, headers: { get: () => "1" } }
        : { status: 200, headers: { get: () => null } };
    },
    sleep: async ms => delays.push(ms)
  });
  const response = await request("https://www.facebook.com/");
  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [1000]);
});

test("does not retry authentication failures or unsafe POST by default", async () => {
  let attempts = 0;
  const request = createRequestClient({
    fetchImpl: async () => { attempts++; return { status: 401, headers: { get: () => null } }; },
    sleep: async () => {}
  });
  const response = await request("https://www.facebook.com/");
  assert.equal(response.status, 401);
  assert.equal(attempts, 1);
  await request("https://www.facebook.com/api", { method: "POST" });
  assert.equal(attempts, 2);
});

test("rejects insecure request URLs", async () => {
  const request = createRequestClient({ fetchImpl: async () => ({ status: 200 }) });
  await assert.rejects(request("http://example.com/"), /HTTPS/);
});
