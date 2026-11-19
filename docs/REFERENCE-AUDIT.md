# OmegA-FCA Reference Audit

Reviewed on 2026-11-19. This is a design and risk audit, not a certification of either reference implementation.

## VangBanLaNhat/fca-unofficial

Repository: https://github.com/VangBanLaNhat/fca-unofficial

Observed structure:
- A central login/bootstrap module builds the API and wires action modules.
- Action methods are separated by operation.
- Shared request/session helpers own cookie handling, request defaults, token extraction, and response parsing.
- Realtime MQTT is part of the runtime and is exposed through the legacy listen surface.

Important findings:
- The package metadata declares MIT, but the root LICENSE file could not be retrieved from the repository during this audit. Treat the declared license as unverified until the actual grant and notices are checked.
- The inspected package manifest still depends on legacy `request`, Bluebird, and old MQTT/websocket-era dependencies; it targets Node.js >=22.
- The inspected login module contains special-case checkpoint behavior (including an automated checkpoint path). OmegA-FCA will not adopt checkpoint bypass or automatic challenge handling.
- Cookie and HTML/token parsing are tightly coupled to Facebook page structure. OmegA should isolate these parsers, validate inputs, and return explicit unsupported/challenge outcomes rather than assuming page markup remains stable.
- Some retry behavior is response-status driven. OmegA must distinguish idempotent reads from non-idempotent sends before retrying.

Decision: use the module boundaries and API coverage as study material only. Do not add this package as a runtime dependency, and do not copy source until its license and required notices are verified.

## dongp06/fca-unofficial

Repository: https://github.com/dongp06/fca-unofficial

Observed documentation describes:
- A legacy-compatible flat API and a namespaced client facade.
- Promise and callback login surfaces.
- A high-level event-driven bot/context layer.
- Explicit MQTT lifecycle, event types, and reconnect behavior.
- A TypeScript build/typecheck/test toolchain.

Important findings:
- GitHub marks the repository archived (read-only).
- The documented architecture is useful for API ergonomics and separation of concerns, but it is not a suitable active dependency.

Decision: use as a documentation and API-design reference only.

## anbuinfosec/fca-unofficial

Repository: https://github.com/anbuinfosec/fca-unofficial

The README claims GoatBot-V2 compatibility and describes broad authentication, MQTT resilience, delivery fallback, and metrics features. These are claims in the repository documentation, not independently verified guarantees.

Decision: compare expected GoatBot API shapes against it, but do not inherit claims or code without source-level review and testing.

## OmegA implementation choices

1. Keep the existing OmegA security/session and connection foundations.
2. Implement AppState/cookie session bootstrap before considering credential login.
3. Keep challenge/checkpoint completion manual and account-owner controlled.
4. Use a modern, maintained HTTP/WebSocket/MQTT dependency only after checking its current maintenance, license, and Node.js support.
5. Keep MQTT frame decoding, event normalization, and event dispatch as separate modules.
6. Use capability declarations and typed unsupported-method errors.
7. Never automatically retry a non-idempotent send unless a verified idempotency mechanism exists.
8. Keep all live-account integration tests opt-in and outside CI; CI uses synthetic fixtures only.
9. Do not replace GoatBot's current FCA dependency until compatibility tests pass for the commands and event types it actually uses.

## Evidence limits

This audit inspected repository metadata, README/API documentation, selected source modules, and the current OmegA-FCA public branch. It did not execute the reference packages, authenticate to Facebook, capture live protocol traffic, or verify that undocumented endpoints still work. No production readiness claim should be made from this review alone.
