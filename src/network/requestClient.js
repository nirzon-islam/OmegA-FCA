"use strict";

function retryAfterMs(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 120_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - now, 120_000)) : null;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function createRequestClient({ fetchImpl = globalThis.fetch, timeoutMs = 20_000, maxAttempts = 3, baseDelayMs = 500, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = Math.random } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch implementation is required");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new TypeError("maxAttempts must be between 1 and 5");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError("timeoutMs must be a positive integer");

  return async function request(input, options = {}) {
    const url = input instanceof URL ? input : new URL(input);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      throw new TypeError("Facebook requests must use HTTPS");
    }
    if (url.username || url.password) throw new TypeError("Request URL must not contain credentials");
    const method = String(options.method || "GET").toUpperCase();
    const canRetry = options.retryable === true ||
      (options.retryable !== false && (method === "GET" || method === "HEAD"));
    const { retryable: _retryable, ...fetchOptions } = options;
    let attempt = 0;
    while (true) {
      let response;
      try {
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
        response = await fetchImpl(url, { ...fetchOptions, signal });
      } catch (error) {
        if (!canRetry || attempt + 1 >= maxAttempts || error.name === "AbortError" || error.name === "TimeoutError") throw error;
        const delay = Math.min(30_000, baseDelayMs * (2 ** attempt)) * (0.8 + random() * 0.4);
        attempt++;
        await sleep(Math.round(delay));
        continue;
      }
      if (!isRetryableStatus(response.status) || !canRetry || attempt + 1 >= maxAttempts) return response;
      try { await response.body?.cancel?.(); } catch {}
      const serverDelay = retryAfterMs(response.headers?.get?.("retry-after"));
      const delay = serverDelay === null
        ? Math.min(30_000, baseDelayMs * (2 ** attempt)) * (0.8 + random() * 0.4)
        : serverDelay;
      attempt++;
      await sleep(Math.round(delay));
    }
  };
}

module.exports = { createRequestClient, retryAfterMs, isRetryableStatus };
