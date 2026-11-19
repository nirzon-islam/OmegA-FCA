# GoatBot integration audit

**Target:** `nirzon-islam/OmegA-Goatbot`  
**Branch reviewed:** `fca-migration-cleanup`  
**OmegA-FCA branch:** `public-package`  
**Review status:** partial source audit; not a migration approval.

## Verified integration contract

The current GoatBot login module imports `@eryxenx/fca` and invokes it using the callback form:

```js
login({ appState }, options, callback)
```

The successful callback is expected to provide an API object with at least:

- `getCurrentUserID()` — used immediately to set `global.GoatBot.botID` and `global.botID`.
- `listenMqtt(callback)` — used as the long-lived Messenger event stream.
- `stopListening(callback?)` — used by GoatBot's listener lifecycle and account-switch/recovery flow.

Additional API surface used or explicitly probed by the login module:

- `sessionGuard(accountPath, options)` — optional account-file/session guard.
- `stopSessionGuard()` — optional guard shutdown.
- `setOptions(options)` — exposed by some FCA builds and relevant to runtime option updates.
- `e2ee.isConnected()` — optional E2EE status probe; absence is tolerated.

The login flow also expects the MQTT callback convention `(error, event)`, and it uses the ready event to determine whether a candidate session has become usable. A callback-compatible login adapter alone is therefore insufficient: the transport must deliver the expected event lifecycle.

## Input formats currently accepted by GoatBot

The current account loader supports several formats before it calls FCA:

- AppState JSON array, including legacy `name` cookie keys and `key` cookie keys.
- Cookie header string.
- Netscape cookie text.
- Legacy email/password/2FA configuration and interactive owner input.
- Legacy token-based input paths.

The current OmegA-FCA client has explicit `appstate`, `cookie`, and `credentials` modes. The compatibility adapter currently maps AppState arrays and fb_email/password credentials; it does not yet reproduce every legacy account-file parser or interactive login behavior.

## Confirmed compatibility gaps

1. OmegA-FCA's `createClient` still requires an injected `authenticate` transport provider. It does not perform Facebook authentication itself.
2. There is no native Facebook HTTP action implementation or MQTT/WebSocket transport/event decoder in this branch yet.
3. The current GoatBot adapter is callback-style at the login boundary, but GoatBot's full event lifecycle and session helper expectations are not yet implemented as a complete compatibility layer.
4. OmegA-FCA's exposed driver method list must be compared against all GoatBot command, event, dashboard, database, and custom-script call sites before claiming drop-in compatibility.
5. E2EE is not implemented by the current OmegA-FCA client.

## Migration gate

Do not change GoatBot's dependency or replace its existing FCA until all of the following are true:

- Native authentication and transport are implemented using owner-controlled, legitimate platform login flows.
- MQTT readiness, reconnect, event ordering, and shutdown behavior pass synthetic and opt-in integration tests.
- The complete GoatBot API call inventory is mapped to OmegA-FCA methods and callback/promise semantics.
- Session guard and account-switch behavior have tested equivalents or an explicitly approved compatibility plan.
- Existing GoatBot secure-session tests and the OmegA-FCA test suite pass in CI.
- A controlled test branch run confirms startup, message receive/send, thread/group operations, and recovery without exposing live cookies or credentials.

## Security and scope

Never put live cookies, AppState, passwords, 2FA material, or session keys in tests, commits, logs, or CI artifacts. Checkpoints and 2FA challenges must remain owner-controlled; do not bypass them. This audit does not authorize replacing the GoatBot dependency, merging branches, or deploying either project.
