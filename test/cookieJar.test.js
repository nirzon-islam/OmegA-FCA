"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CookieJar } = require("../src/network/cookieJar");

test("scopes cookies by host, path, secure flag, and expiry", () => {
  const now = 1_800_000_000_000;
  const jar = new CookieJar([
    { key: "root", value: "r", domain: "facebook.com", path: "/", hostOnly: false },
    { key: "mobile", value: "m", domain: "m.facebook.com", path: "/messages", hostOnly: true },
    { key: "secure", value: "s", domain: "facebook.com", path: "/", secure: true },
    { key: "expired", value: "x", domain: "facebook.com", path: "/", expires: now - 1000 }
  ], { now: () => now });
  assert.equal(jar.getCookieHeader("https://m.facebook.com/messages/inbox"), "mobile=m; root=r; secure=s");
  assert.equal(jar.getCookieHeader("http://m.facebook.com/messages/inbox"), "mobile=m; root=r");
  assert.equal(jar.getCookieHeader("https://www.facebook.com/"), "root=r; secure=s");
  assert.equal(jar.getCookieHeader("https://example.com/"), "");
});

test("replaces duplicate cookie tuples and clears the jar", () => {
  const jar = new CookieJar([{ key: "xs", value: "old", domain: "facebook.com" }]);
  jar.setCookies([{ key: "xs", value: "new", domain: "facebook.com" }]);
  assert.equal(jar.size, 1);
  assert.equal(jar.getCookieHeader("https://facebook.com/"), "xs=new");
  jar.clear();
  assert.equal(jar.size, 0);
});
