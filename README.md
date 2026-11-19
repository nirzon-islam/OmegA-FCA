# OmegA Bot — OmegA-FCA

**An independent FCA-compatible transport foundation by NirZon.**

OmegA-FCA is the Facebook integration library maintained under the **OmegA Bot** brand by **NirZon**.

> **Status:** personal-account compatibility bridge added. This package can adapt an existing authorized personal-account FCA login implementation, but it does not implement Facebook's private login or MQTT wire protocol itself and is not a standalone FCA engine.

**Package:** `@omega/fca` · **Node.js:** 20+ · **Author:** NirZon

## Included

- AppState/cookie validation, secure encrypted session storage, secret redaction.
- Native personal-session bootstrap for owner-supplied AppState, including HTTPS-only Facebook/Messenger requests, cookie rotation, and checkpoint/expiry detection.
- `createFacebookWebClient()`: bounded authenticated GET/POST/HEAD request layer, session-token injection for POST forms, redirect challenge classification, response normalization, and request/response size limits. It deliberately requires caller-supplied verified paths and payload schemas.
- `FB_USERNAME` credentials are accepted by the client and GoatBot compatibility mapper; native username/password authentication is not yet implemented.
- Manual 2FA input plumbing and checkpoint/session-expiry classification. Challenges must be resolved by the account owner.
- Connection supervision, bounded reconnect/backoff and event dispatch.
- `createLegacyFcaProvider()`: adapter for an existing callback-style personal-account FCA implementation.
- `createGoatBotLogin()`: callback-style GoatBot login adapter.
- Personal-account driver method forwarding for messaging, threads, reactions, typing, and group actions when the supplied FCA implementation supports those methods.
- Separate official Meta Messenger Page transport (not a personal-account replacement).
- TypeScript declarations, signed update-manifest verification, optional Ed25519 licensing.

## Root account.txt configuration loader

The package exports `loadAccountConfig()` to read credentials from the project-root `account.txt`, or AppState from the root `appstate.json`. Environment variables override values in the file. Create `account.txt` in the project root and fill in your own values:

```ini
fb_username=YOUR_FACEBOOK_USERNAME
fb_password=YOUR_FACEBOOK_PASSWORD
# Or use fb_email instead of fb_username.
# fb_email=you@example.com
# fb_2fa_code=123456
# For AppState mode, omit credentials and use root appstate.json.
```

`account.txt` is ignored by Git; it stays in your local project root and is not automatically pushed to GitHub. The loader only parses and validates configuration. It does **not** perform native Facebook password login or provide MQTT/realtime messaging; those standalone engine components remain incomplete. When `createGoatBotLogin(client)` is called with an empty credentials object, the adapter now reads this root `account.txt` automatically (or falls back to root `appstate.json`) and passes the selected mode to the configured client provider. This is configuration wiring only; it does not make the current client a native Facebook login engine.

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
