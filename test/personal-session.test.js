"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPersonalSession, detectSessionChallenge, extractIdentity } = require("../src/auth/personalSession");

const appState = [
  { key: "c_user", value: "123456789012345", domain: ".facebook.com", path: "/", secure: true, httpOnly: true },
  { key: "xs", value: "session-token", domain: ".facebook.com", path: "/", secure: true, httpOnly: true }
];

function response({ status = 200, location = null, html = "<html><body>Home</body></html>", setCookies = [] } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        if (name.toLowerCase() === "location") return location;
        if (name.toLowerCase() === "content-length") return String(Buffer.byteLength(html));
        if (name.toLowerCase() === "set-cookie") return setCookies.join(", ");
        return null;
      },
      getSetCookie() { return setCookies; }
    },
    async text() { return html; }
  };
}

test("personal session validates owner-supplied AppState and scopes cookies to Facebook HTTPS", async () => {
  let request;
  let calls = 0;
  const session = await createPersonalSession({
    appState,
    fetchImpl: async (url, options) => {
      request = { url, options };
      calls++;
      return calls === 1 ? response() : response({
        setCookies: ["sid=refreshed; Domain=.facebook.com; Path=/; Secure; HttpOnly"]
      });
    }
  });
  assert.equal(session.userId, "123456789012345");
  assert.equal(session.state, "active");
  assert.match(request.options.headers.cookie, /c_user=123456789012345/);
  assert.match(request.options.headers.cookie, /xs=session-token/);
  assert.equal(session.getCookieHeader("https://www.facebook.com/").includes("xs=session-token"), true);
  assert.throws(() => session.getCookieHeader("https://example.com/"), /Facebook\/Messenger HTTPS hosts/);
  await session.request("https://www.facebook.com/messages/", { method: "GET" });
  assert.match(session.getCookieHeader(), /sid=refreshed/);
  await assert.rejects(session.request("https://example.com/"), /Facebook\/Messenger HTTPS hosts/);
  session.close();
  assert.throws(() => session.getAppState(), /closed/);
});

test("personal session reports checkpoint without attempting a bypass", async () => {
  await assert.rejects(
    createPersonalSession({
      appState,
      fetchImpl: async () => response({ html: "<html>checkpoint_required</html>" })
    }),
    error => error.code === "FCA_CHECKPOINT_REQUIRED" && error.retryable === false
  );
});

test("personal session reports expired AppState on login redirect", async () => {
  await assert.rejects(
    createPersonalSession({
      appState,
      fetchImpl: async () => response({ status: 302, location: "https://www.facebook.com/login.php" })
    }),
    error => error.code === "FCA_SESSION_EXPIRED" && error.sessionState === "logged_out"
  );
});

test("identity extraction is conservative and bounded to numeric Facebook IDs", () => {
  assert.equal(extractIdentity('{"USER_ID":"123456789012345"}'), "123456789012345");
  assert.equal(extractIdentity('{"USER_ID":"not-an-id"}'), null);
  assert.equal(detectSessionChallenge(response(), "<html>home</html>"), "active");
  assert.equal(detectSessionChallenge(response(), "<html>checkpoint_required</html>"), "checkpoint");
});
