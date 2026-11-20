# OmegA FCA Browser Capture

This owner-operated tool launches a visible Chromium window for manual Facebook/Messenger login and captures browser network metadata for protocol research.

## Setup

Node.js 20+ is required.

```sh
npm install --no-save playwright
npx playwright install chromium
npm run capture:browser
```

The browser opens Facebook. Sign in manually in that window, open Messenger, and reproduce the normal account activity needed to establish the realtime connection (for example, open a conversation and receive/send a test message to an account you control). Do not paste passwords, cookies, AppState, 2FA codes, or access tokens into the terminal or a report.

Press Ctrl+C when finished. The sanitized report is written to:

`.omega-capture/capture-report.json`

The report records request method, origin/path (query strings omitted), response status/content type, WebSocket direction, frame size, and redacted text-frame previews. It does not record HTTP request/response bodies, cookie/header values, or browser storage.

## Binary frame payloads

The default mode intentionally does not save binary frame contents. If frame bytes are required for local protocol inspection, run:

```sh
npm run capture:browser -- --save-private-frames
```

This writes raw WebSocket frame payloads to `.omega-capture/private/frames.ndjson`. **These private frames may contain authentication material, identifiers, or private message data.** Keep this directory on your own machine, do not commit it, and do not upload/share it unredacted. Inspect and redact it locally before sharing selected protocol evidence.

## Limitations

- The browser is launched on the machine running this command; it is not remotely visible to ChatGPT.
- Facebook may show a checkpoint or require additional verification. Complete it yourself in the visible browser.
- The tool does not bypass login, checkpoints, rate limits, or account security.
- Captures are evidence, not a protocol implementation. The native FCA adapter must be built from reviewed, current, reproducible observations.
- This utility does not send captures to any server.

## Troubleshooting

If Chromium is missing, run `npx playwright install chromium`. If launch fails in a headless Linux environment, install the OS dependencies with Playwright's documented browser setup command.
