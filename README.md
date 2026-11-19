# OmegA Bot — OmegA-FCA

**An independent FCA-compatible transport foundation by NirZon.**

OmegA-FCA is the Facebook integration library maintained under the **OmegA Bot** brand by **NirZon**.

> **Status:** personal-account compatibility bridge added. This package can adapt an existing authorized personal-account FCA login implementation, but it does not implement Facebook's private login or MQTT wire protocol itself and is not a standalone FCA engine.

**Package:** `@omega/fca` · **Node.js:** 20+ · **Author:** NirZon

## Included

- AppState/cookie validation, secure encrypted session storage, secret redaction.
- Manual 2FA input plumbing and checkpoint/session-expiry classification. Challenges must be resolved by the account owner.
- Connection supervision, bounded reconnect/backoff and event dispatch.
- `createLegacyFcaProvider()`: adapter for an existing callback-style personal-account FCA implementation.
- `createGoatBotLogin()`: callback-style GoatBot login adapter.
- Personal-account driver method forwarding for messaging, threads, reactions, typing, and group actions when the supplied FCA implementation supports those methods.
- Separate official Meta Messenger Page transport (not a personal-account replacement).
- TypeScript declarations, signed update-manifest verification, optional Ed25519 licensing.

## Personal-account adapter

The adapter lets an existing FCA implementation plug into OmegA-FCA without pretending that the Facebook protocol has been reimplemented:

```js
const { createClient, createLegacyFcaProvider } = require("@omega/fca");
const legacyFcaLogin = require("@eryxenx/fca");

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

The adapter maps the existing FCA's callback login, AppState/credentials input, identity lookup, MQTT listener, and supported API methods into OmegA-FCA's transport contract. It does **not** create a new Facebook transport implementation.

## What is still required for a standalone replacement

- Independently implemented personal-account authentication and session lifecycle.
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
