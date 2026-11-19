# OmegA-FCA

Private, owner-licensed FCA-compatible client library for OmegA projects.

## Status

**Development: 0.1.0 — foundation stage.** This repository is the private source of truth. Do not place proprietary implementation files in the public OmegA-Goatbot repository.

## Design goals

- Independent implementation; no copied FCA source.
- Node.js 20+ and CommonJS compatibility for the current GoatBot runtime.
- Explicit login modes: credentials (including manual 2FA/checkpoint handling) and AppState/cookie.
- Safe session lifecycle, bounded reconnect/backoff, listener deduplication, and redacted diagnostics.
- Optional owner-controlled license verification for approved installations.
- A small adapter surface so GoatBot can migrate without rewriting command handlers.
- Agent Backend integration through its existing signed bridge and one-time recovery handoff.

## Security boundaries

This project does not bypass Facebook checkpoints, 2FA, rate limits, or other account security controls. Unofficial Facebook interfaces can change without notice; no implementation can guarantee an account will never be checkpointed or restricted. Never commit live cookies, passwords, AppState, or access tokens.

## Current exports

The first foundation milestone exports cookie normalization/parsers and recursive secret redaction. Authentication, transport, listener, messaging methods, license service, and GoatBot adapter are not yet implemented.

## Development

```sh
npm test
npm run test:syntax
```

Use synthetic fixtures only. For live-account validation, do not paste credentials into chat or commit them to the repository.
