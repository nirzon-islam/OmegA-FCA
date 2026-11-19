# OmegA Bot — OmegA-FCA

**An independent FCA-compatible transport foundation by NirZon.**

OmegA-FCA is the Facebook integration library maintained under the **OmegA Bot** brand by **NirZon**.

> **Status:** personal-account compatibility bridge added. This package can adapt an existing authorized personal-account FCA login implementation, but it does not implement Facebook's private login or MQTT wire protocol itself and is not a standalone FCA engine.

**Package:** `@omega/fca` · **Node.js:** 20+ · **Author:** NirZon

## Included

- AppState/cookie validation, secure encrypted session storage, secret redaction.
- `createDiagnosticRecorder()`: bounded request metadata reports that omit header values, query values, body values, response bodies and credentials.
- Native personal-session bootstrap for owner-supplied AppState, including HTTPS-only Facebook/Messenger requests, cookie rotation, and checkpoint/expiry detection.
- `createFacebookWebClient()`: bounded authenticated GET/POST/HEAD request layer, session-token injection for POST forms, redirect challenge classification, response normalization, and request/response size limits. It deliberately requires caller-supplied verified paths and payload schemas.
- `FB_USERNAME` credentials are accepted by the client and GoatBot compatibility mapper; native username/password authentication is not yet implemented.
- Manual 2FA input plumbing and checkpoint/session-expiry classification. Challenges must be resolved by the account owner.
- Connection supervision, bounded reconnect/backoff and event dispatch.
- Bounded realtime binary-frame envelope inspection based only on the observed WebSocket capture; no private protocol assumptions.
- `createLegacyFcaProvider()`: adapter for an existing callback-style personal-account FCA implementation.
- `createGoatBotLogin()`: callback-style GoatBot login adapter.
- Personal-account driver method forwarding for messaging, threads, reactions, typing, and group actions when the supplied FCA implementation supports those methods.
- Separate official Meta Messenger Page transport (not a personal-account replacement).
- TypeScript declarations, signed update-manifest verification, optional Ed25519 licensing.

## GoatBot account configuration

Credential login reads the canonical `fb_email` field from `config.json`:

```json
{
  "facebookAccount": {
    "fb_email": "you@example.com",
    "password": "YOUR_FACEBOOK_PASSWORD",
    "2FASecret": "YOUR_BASE32_TOTP_SECRET",
    "i_user": "",
    "proxy": null,
    "userAgent": "Mozilla/5.0"
  }
}
```

The legacy `email` property is accepted as a compatibility alias, but `fb_email` is canonical. `fb_username` / `FB_USERNAME` is not used. `2FASecret` is a Base32 TOTP seed; the adapter generates a fresh six-digit RFC 6238 code when it starts a credentials login. The secret itself is never used as the one-time code.

For cookie/AppState login, put only the cookie header, Netscape cookie export, or JSON cookie array in the project-root `account.txt`. A non-empty `account.txt` takes precedence over credentials in `config.json`; remove/empty it when you want the configured credentials mode. The root `appstate.json` remains a compatibility fallback.

**Important:** `account.txt` is strictly AppState/cookie-only. Never put email, password, username, or 2FA values in it. Credentials and TOTP configuration belong in `config.json → facebookAccount`.

`account.txt`, `config.json`, passwords, cookies, and 2FA seeds must stay private and must not be committed. This is configuration/TOTP wiring only; it does **not** implement Facebook's native password-login protocol or realtime MQTT transport.

## Personal AppState session foundation

The first native session layer can validate an owner-supplied AppState and issue bounded HTTPS requests only to Facebook/Messenger hosts. It preserves scoped response cookies and stops with an explicit checkpoint or expired-session error; it does not bypass either state.

```js
const { createPersonalSession } = require("@omega/fca");
const session = await createPersonalSession({ appState: require("./account.json") });
const response = await session.request("https://www.facebook.com/");
console.log(session.userId, response.status);
// Call session.close() when finished.
```

This is a session foundation only: it does not yet provide the full FCA action API or realtime listener.

## Realtime frame inspection

The Android Messenger Web capture confirmed a successful `/ws/realtime` WebSocket handshake and binary frames containing a JSON-like `events` envelope with `name` and `args` fields. OmegA-FCA now includes `decodeRealtimeFrame()` and `summarizeRealtimeFrame()` for bounded inspection of that observed envelope. The undocumented binary prefix remains opaque; this is not yet a socket client, authentication flow, subscription/acknowledgement implementation, event semantic map, message sender, or E2EE implementation. See [Realtime frame evidence](docs/REALTIME-FRAME-EVIDENCE.md).

## Safe diagnostic reports

A secret-safe diagnostic recorder is available for the current AppState-backed session layer. It records request structure and response metadata, not secrets or payload contents. See [Safe diagnostics](docs/SAFE-DIAGNOSTICS.md) for usage.

**Important:** this currently instruments AppState session requests only. It cannot capture a username/password login trace because native Facebook credential login is not implemented yet.

## Legacy compatibility adapter (temporary migration/test utility)

The adapter lets an existing FCA implementation plug into OmegA-FCA without pretending that the Facebook protocol has been reimplemented:

```js
const { createClient, createLegacyFcaProvider } = require("@omega/fca");
// Supply a caller-owned FCA implementation only when testing the migration adapter.
const legacyFcaLogin = require("your-existing-fca");

const authenticate = createLegacyFcaProvider({
  login: legacyFcaLogin,
  options: { forceLogin: false }
});
const client = createClient({ authenticate });

const api = await client.login({
  mode: "appstate",
  appState: require("./account.json")
});
api.listenMqtt((error, event) => {
  if (error) console.error("FCA listener error:", error.message);
  else if (event) console.log("Event:", event.type);
});
```

Use only an account and session you own or are authorized to operate. Keep `account.json`, passwords, 2FA secrets, and session keys outside source control. If Facebook presents a checkpoint, resolve it through Facebook as the account owner and then retry with a fresh authorized session.

This legacy adapter is not the OmegA-FCA engine and is not used by the native session foundation. It exists only as an optional migration/test shim. The target runtime is being implemented inside OmegA-FCA itself.

## What is still required for a standalone replacement

- Native username/password authentication (including owner-controlled 2FA and checkpoint handoff), plus full session lifecycle.
- Independently implemented Facebook realtime transport and event decoding.
- Complete legacy FCA behavior parity and real authorized-account end-to-end tests.
- GoatBot integration test on the target bot branch.

Do not replace GoatBot's current FCA dependency with this package as a standalone transport until those gates pass. The Page transport is separate and does not satisfy personal profile or group-chat requirements.

## Security

Never commit cookies, AppState, passwords, 2FA secrets, encryption keys, or tokens. The library does not bypass checkpoints, 2FA, rate limits, or platform security controls. Unofficial interfaces may change and may result in account restrictions.

## Development

```bash
npm ci
npm test
npm run test:syntax
npm pack --dry-run
```

## Ownership

**OmegA Bot** — developed and maintained by **NirZon**.

MIT License. See [LICENSE](LICENSE).
