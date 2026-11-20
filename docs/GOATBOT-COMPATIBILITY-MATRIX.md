# GoatBot compatibility matrix

**Target:** `nirzon-islam/OmegA-Goatbot`  
**GoatBot branch reviewed:** `fca-migration-cleanup`  
**OmegA-FCA branch:** `public-package`  
**Status:** API-foundation mapping only; not a drop-in compatibility declaration.

This matrix separates what the current OmegA-FCA facade exposes from what still requires a real transport and end-to-end verification. A method appearing in the facade means only that the injected driver supplied it; it does not mean Facebook behavior is implemented by this package.

## Login and lifecycle

| GoatBot expectation | Current OmegA-FCA status | Notes |
|---|---|---|
| `login({ appState }, options, callback)` | Partial | `createGoatBotLogin` maps AppState arrays, credentials, and a separately supplied `twoFactorCode` to `createClient.login`; no native Facebook authentication. |
| `getCurrentUserID()` | Conditional | Exposed after login; returns the driver identity converted to a string, or null. |
| `listenMqtt(callback)` | Conditional | Adapts the driver's `listen` to error-first `(error, event)`; requires a working driver. |
| `stopListening(callback?)` | Implemented at facade boundary | Detaches the active listener and invokes an optional callback. |
| `sessionGuard(path, options)` | Pass-through only | Exposed only if the injected driver implements it; no built-in account-file watcher. |
| `stopSessionGuard()` | Pass-through only | Exposed only if supplied by the driver. |
| `setOptions(options)` | Pass-through only | Exposed only if supplied by the driver. |
| `e2ee.isConnected()` | Not implemented | No E2EE implementation in this branch. |

## Conditional driver API

The client exposes each method below only when the injected driver provides that function. No successful Facebook action is implied by the method name.

| Method | License feature gate (when licensing enabled) | Current status |
|---|---|---|
| `sendMessage`, `unsendMessage`, `markAsRead`, `sendTypingIndicator` | `messaging` | Driver pass-through only |
| `getUserInfo`, `getThreadInfo`, `getThreadList`, `getThreadHistory`, `getMessage`, `getFriendsList`, `getUserID` | `threads` | Driver pass-through only |
| `addUserToGroup`, `removeUserFromGroup`, `createNewGroup`, `changeNickname` | `groups` | Driver pass-through only |
| `setMessageReaction` | `reactions` | Driver pass-through only |

## Required work before migration

- Implement and review a legitimate, owner-controlled authentication/session flow. The provider input now supports a manually entered `twoFactorCode`; checkpoint resolution remains manual and must be completed by the account owner before retrying with the authorized session.
- Implement HTTP action serialization, response/error normalization, and safe retry policy. Do not automatically retry non-idempotent sends.
- Implement realtime transport, bounded frame parsing, event decoding/normalization, readiness semantics, reconnect and deterministic shutdown.
- Inventory every FCA call site across GoatBot commands, events, dashboard, database and custom scripts; this document is not a complete call-site inventory.
- Add contract tests for every required method and callback shape, then opt-in integration tests using an authorized test account.
- Verify CI on the target branch and run GoatBot's own tests before considering a dependency switch.

## Release decision

**Do not replace GoatBot's current FCA dependency, merge this branch, or deploy on the strength of this matrix.** Native auth, HTTP actions, realtime transport, event decoding, E2EE, and complete call-site coverage remain unverified or unimplemented. Never put live AppState, cookies, passwords, 2FA material, or session keys in fixtures, logs, commits, or CI.


## Working-branch integration update

The GoatBot `fca-migration-cleanup` branch now depends on this package and
routes its login entrypoint through `createGoatBotLogin`. Its
`bot/login/omegaFca.js` currently injects the existing `@eryxenx/fca`
implementation through `createLegacyFcaProvider`.

This verifies the package-to-bot integration boundary only. The actual
Facebook authentication and MQTT event stream still come from the legacy
transport. Native OmegA-FCA authentication/realtime must remain marked
experimental until an authorized live account test proves login readiness,
message receive/send, and recovery. Do not remove the legacy dependency or
claim a standalone native replacement yet.
