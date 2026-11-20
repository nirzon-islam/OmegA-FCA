# GoatBot compatibility matrix

**Target:** `nirzon-islam/OmegA-Goatbot`  
**GoatBot branch reviewed:** `fca-migration-cleanup`  
**OmegA-FCA branch:** `prerelease/0.1.6-rc.3`  
**Status:** Native AppState/MQTT integration wired on the working branch; live acceptance and full FCA parity are still unverified.

This matrix separates what the current OmegA-FCA facade exposes from what still requires a real transport and end-to-end verification. A method appearing in the facade means only that the injected driver supplied it; it does not mean Facebook behavior is implemented by this package.

## Login and lifecycle

| GoatBot expectation | Current OmegA-FCA status | Notes |
|---|---|---|
| `login({ appState }, options, callback)` | Native AppState path wired | `createGoatBotLogin` maps AppState arrays to `createFacebookMqttClient`; native HTTPS session validation and MQTT setup run before callback success. Real-account acceptance is still pending. |
| `getCurrentUserID()` | Native | Returns the authenticated account ID. |
| `getAppState()` | Native, sensitive | Returns the current cookie/AppState array for owner-only legacy commands such as `getfbstate`; never log or expose it to ordinary users. |
| `listenMqtt(callback)` | Native adapter wired | Adapts the native driver's `listen` to error-first `(error, event)` and emits a `ready` event after successful MQTT setup. Live event compatibility remains unverified. |
| `stopListening(callback?)` | Implemented at facade boundary | Detaches the active listener and invokes an optional callback. |
| `sessionGuard(path, options)` | Native encrypted sidecar, opt-in | Preserves GoatBot’s legacy `account.txt` argument as an activation alias; the actual encrypted snapshot and backup live at `FCA_SESSION_FILE`, never in `account.txt`. The legacy `interval` option is honored; `debounce` is accepted but does not change periodic snapshot behavior. |
| `stopSessionGuard()` | Native encrypted guard lifecycle | Stops periodic saves, performs a final encrypted save, and closes the guard. |
| `setOptions(options)` | Pass-through only | Exposed only if supplied by the driver. |
| `e2ee.isConnected()` | Not implemented | No E2EE implementation in this branch. |

## Encrypted SessionGuard deployment compatibility

The FCA factory accepts optional `FCA_SESSION_FILE`, `FCA_SESSION_KEY`, and `FCA_SESSION_INTERVAL_MS` environment variables. This lets the existing GoatBot `omegaFca.js` client construction remain unchanged. Its current `sessionGuard(account.txt, { interval, debounce })` call activates the configured encrypted sidecar and honors `interval`; it never reads, truncates, replaces, or writes encrypted data to `account.txt`. The encrypted primary and `.bak` backup are rejected if either resolves to the Bot's root `account.txt`.

If these optional variables are not configured, SessionGuard remains disabled and the Bot's existing plaintext AppState flow is unchanged. Do not change Bot-required credentials or tracked configuration to enable this optional feature.

## Conditional driver API

The client exposes each method below only when the injected driver provides that function. No successful Facebook action is implied by the method name.

| Method | License feature gate (when licensing enabled) | Current status |
|---|---|---|
| `sendMessage` | `messaging` | Experimental native MQTT task builder; broker acceptance and recipient delivery are unverified. |
| `markAsRead` | `messaging` | Native AppState-backed web action with synthetic request/response tests; live endpoint acceptance is unverified. |
| `unsendMessage`, `sendTypingIndicator` | `messaging` | Not yet verified in the first-party native driver; exposed only when a supplied driver implements them. |
| `getUserInfo`, `getThreadInfo`, `getThreadList`, `getThreadHistory` | `threads` | Native AppState-backed web actions with synthetic tests; live Facebook endpoint behavior is unverified. |
| `httpPost` | compatibility | Authenticated low-level POST returning response text; restricted to Facebook/Messenger HTTPS hosts and bounded request/response sizes. Supports custom GoatBot GraphQL commands such as friend-request management. |
| `getMessage`, `getFriendsList` | `threads` | Not yet implemented by the first-party native driver; optional pass-through only. |
| `getUserID` | `threads` | Alias to the authenticated account identity. |
| `addUserToGroup`, `removeUserFromGroup`, `changeNickname` | `groups` | Native AppState-backed web actions with synthetic tests; live acceptance is unverified. |
| `createNewGroup` | `groups` | Not exposed until its request contract is evidenced. |
| `setMessageReaction` | `reactions` | Native AppState-backed web action with synthetic tests; live acceptance is unverified. |

## Additional legacy methods found in the partial GoatBot command audit

The source scan of the current `fca-migration-cleanup` branch found additional method calls beyond the core login contract:

- Implemented in the native facade: `getAppState`, `httpPost`, `sendMessage`, `getCurrentUserID`, `getThreadList`, `getThreadInfo`, `getThreadHistory`, `getUserInfo`, `addUserToGroup`, `removeUserFromGroup`, `changeNickname`, `changeThreadEmoji`/color/title are not yet implemented, and `setMessageReaction`.
- Still missing or not verified: `unsendMessage`, `changeGroupImage`, `changeAvatar`, `setTitle`, `changeThreadEmoji`, `changeThreadColor`, `shareContact`, and the runtime semantics of `setOptions`.
- This was a partial scan of command files, not the complete 271-file repository inventory; event handlers, dashboard, database, custom scripts, and dynamically accessed methods still need review.

## Required work before migration

- Complete live validation of the owner-supplied AppState session; username/password and 2FA login remain deferred, and checkpoint resolution remains manual.
- Complete the source-level inventory of every FCA method/event used across GoatBot commands, events, dashboard, database and custom scripts; this matrix is not yet a complete call-site inventory.
- Add the missing legacy methods and event shapes only when their request contracts and behavior are evidenced; do not return dummy success responses.
- Validate native MQTT frame decoding, event normalization, readiness, reconnect and deterministic shutdown against an authorized account; synthetic fake-broker coverage is not live acceptance.
- Run the owner-operated `npm run test:messenger-mqtt` check for live readiness and inbound events; use its explicit opt-in send mode only against a thread the owner controls and verify recipient delivery.
- Run GoatBot's existing secure-session tests and a full startup/contract test against the intended released package before changing the dependency.
- Verify CI on the latest prerelease head; keep username/password login deferred and preserve all existing Bot credentials/configuration.

## Release decision

**Do not treat the working branch as production-accepted until an authorized live account test passes.** AppState session setup and native MQTT transport are now wired, but private Facebook endpoint behavior, message delivery, complete API parity, E2EE, and all call-site coverage remain unverified or unimplemented. Never put live AppState, cookies, passwords, 2FA material, or session keys in fixtures, logs, commits, or CI.


## Working-branch integration update

The GoatBot `fca-migration-cleanup` branch now uses the first-party
`createFacebookMqttClient()` factory through `createGoatBotLogin`. The
`@eryxenx/fca` dependency has been removed from that branch, and OmegA-FCA
owns its WebSocket runtime through its package dependency.

This is a native code-path integration milestone, not live acceptance. The
Facebook-specific MQTT handshake, task schemas, event deltas, and private web
action endpoints remain experimental until an authorized live account test
proves login readiness, message receive/send, and recovery.
