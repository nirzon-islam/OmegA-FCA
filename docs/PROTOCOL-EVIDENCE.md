# Facebook Personal-Account Protocol Evidence

This document separates publicly documented architecture from historical observations and unverified implementation details. It is an engineering evidence register, not a claim that OmegA-FCA currently implements these protocols.

## Evidence matrix

| Area | Public evidence | What it supports | What it does not prove | OmegA-FCA status |
|---|---|---|---|---|
| Messenger realtime architecture | Meta Engineering, [Building Facebook Messenger](https://engineering.fb.com/2011/08/12/android/building-facebook-messenger/) and [Under the Hood: Messenger for Windows](https://engineering.fb.com/2012/03/08/web/under-the-hood-building-facebook-messenger/) | Meta historically described MQTT as a persistent realtime channel for Messenger. | Current personal-profile endpoint, handshake, headers, client identity, topics, packet extensions, or current browser compatibility. | Not implemented |
| Snapshot + delta sync | Meta Engineering, [Building Mobile-First Infrastructure for Messenger](https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/) | Meta described an initial snapshot followed by ordered delta updates over MQTT, backed by Iris. | Current public API, exact snapshot query, queue cursor format, or event payload schema. | Not implemented |
| Legacy FCA listener contract | [facebook-chat-api DOCS.md](https://github.com/Schmavery/facebook-chat-api/blob/master/DOCS.md) | Historical public FCA documentation describes callback-style `listenMqtt(callback)`, error/event callbacks, and stop-listening behavior. | That the historical implementation or event format still works today. | Compatibility facade only; no native listener |
| Historical credential login and 2FA | [fbchat session source](https://github.com/fbchat-dev/fbchat/blob/master/fbchat/_session.py) | A public historical client shows one observed password-login flow and an owner-supplied 2FA callback. | That the route, form fields, redirect sequence, or challenge flow is current or safe to reuse. | Not implemented |
| Recent unofficial implementation claims | [@dongdev/fca-unofficial](https://github.com/donyst/fca-unofficial) | A maintained third-party project claims to implement browser-session HTTP/GraphQL and MQTT behavior. | Independent verification of its current wire protocol, endpoint stability, or compliance. | Reference for further audit only |


## Research update — 2026-11-20

### Independently checked public sources

| Source | Directly supported finding | Boundary |
|---|---|---|
| Meta Engineering, [Building Facebook Messenger](https://engineering.fb.com/2011/08/12/android/building-facebook-messenger/) | Meta described MQTT as a persistent real-time channel in Messenger. | Historical architecture only; not a current personal-profile wire specification. |
| Meta Engineering, [Building Mobile-First Infrastructure for Messenger](https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/) | Meta described snapshot-plus-delta synchronization, with MQTT delivering ordered real-time updates through Iris. | Does not publish current client handshake, broker configuration, subscriptions, or payload schemas. |
| OASIS, [MQTT 3.1.1 specification](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html), Sections 3 and 6 | Defines standard MQTT CONNECT/SUBSCRIBE/PUBLISH packet behavior and MQTT over WebSocket transport requirements, including binary WebSocket frames and the MQTT subprotocol. | Defines MQTT generally; it does not establish which MQTT version, extensions, credentials, or packet fields a current Facebook client uses. |
| [VangBanLaNhat/fca-unofficial](https://github.com/VangBanLaNhat/fca-unofficial) | Public source contains an MQTT listener and event normalization implementation; its package metadata currently requires Node.js 22+. | Unofficial reverse-engineered code is an observation, not a Facebook specification or proof of present-day compatibility. OmegA-FCA must not vendor or copy it. |
| [dongp06/fca-unofficial](https://github.com/dongp06/fca-unofficial) | Public documentation describes a two-layer HTTP/GraphQL + MQTT API and a realtime listener/event API. | GitHub marks this repository archived on 2026-05-09. Its own documentation is not independent verification of current Facebook behavior. |
| Meta Messenger Platform [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-messenger/) and [Quick Start](https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start) | Official supported product flow is Page-based Webhooks and Send API. | Not a personal-profile FCA replacement. |

### Engineering conclusions

1. A WebSocket lifecycle wrapper alone is not an MQTT client and cannot be called a working Messenger realtime transport.
2. Standard MQTT 3.1.1 packet handling can be implemented and tested against the OASIS specification without assuming Facebook-specific behavior.
3. The Facebook-specific adapter remains blocked until current, repeatable, authorized evidence establishes the selected MQTT/WebSocket protocol version, broker/session negotiation, required client metadata, sync bootstrap, subscription/acknowledgement behavior, and event/action envelopes.
4. Historical topic names, endpoint strings, client metadata, GraphQL identifiers, and payload fields found in public forks are not accepted as current facts.
5. No checkpoint, 2FA, anti-abuse, rate-limit, or other account security challenge is to be bypassed.
6. The next implementation slice may build a standards-compliant MQTT 3.1.1 codec/client behind the transport boundary with spec-derived fixtures. It must remain broker-agnostic until the Facebook-specific evidence gate passes.

## Implementation rules

1. Do not infer current endpoints, GraphQL document IDs, MQTT topics, packet fields, login forms, or event schemas from architecture articles.
2. Historical open-source code is an observation, not a current protocol specification.
3. A protocol feature is not marked implemented until its behavior is covered by deterministic fixtures and tests, then validated with an account the tester owns and explicitly authorizes.
4. Authentication must stop and return a clear state when Facebook requests a checkpoint, 2FA, or other owner action. Do not automate challenge bypass.
5. Never place passwords, cookies, AppState, 2FA seeds/codes, or session tokens in tests, fixtures, logs, commits, or issue reports.
6. The official Meta Messenger Platform is Page-based and must not be represented as a personal-profile FCA replacement.

## Current package boundary

The current package provides configuration parsing, AppState validation, bounded HTTPS session primitives, token extraction, a generic transport contract, connection supervision, and a GoatBot login adapter. Credentials mode currently delegates to an injected authentication provider. The legacy FCA adapter delegates to an externally supplied implementation.

Therefore the following remain **not implemented** in the native OmegA engine:

- Facebook username/email + password authentication and owner-controlled 2FA handoff.
- Native personal-account realtime transport and event decoding.
- Verified message/thread/action request catalog and payload schemas.
- Full callback/API parity with the target GoatBot FCA usage.
- Authorized live-account end-to-end verification.

## Release gate

Do not describe this package as a standalone FCA replacement or switch GoatBot's production dependency until every item above is implemented and the following pass:

- Unit tests for login state transitions, cookie/session lifecycle, reconnect behavior, event decoding, and action serialization.
- Protocol fixtures sourced from repeatable, authorized observations with secrets removed.
- Node.js 20+ syntax and test suites.
- An authorized end-to-end test covering login (including manual challenge handoff where applicable), listener startup, inbound event parsing, outbound messaging, logout, and reconnect.
- GoatBot integration test proving the expected callback signatures and methods.

Last reviewed: 2026-11-19.
