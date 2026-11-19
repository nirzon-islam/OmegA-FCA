# Safe diagnostic reports

OmegA-FCA exports `createDiagnosticRecorder()` for collecting bounded request metadata while developing an authorized integration.

The recorder stores only:
- HTTP method, URL origin and path (query values are discarded)
- A filtered list of non-sensitive query parameter and request field names
- An allowlisted set of request header names (never header values)
- Request/response byte counts, response status/content type, duration and safe error codes

It never stores request body values, response bodies, cookie values, authorization values, passwords, AppState, tokens or 2FA codes. Events are capped (100 by default, 1,000 maximum).

## Usage with the current AppState session layer

```js
const { createPersonalSession, createDiagnosticRecorder } = require("@omega/fca");

const diagnostics = createDiagnosticRecorder({ maxEvents: 100 });
const session = await createPersonalSession({
  appState: require("./appstate.json"),
  onDiagnostic: event => diagnostics.record(event)
});

// Exercise only the authorized session operations you are debugging.
await session.request("https://www.facebook.com/");

require("node:fs").writeFileSync(
  "./omega-fca-diagnostics.json",
  diagnostics.toJSON(),
  { mode: 0o600 }
);
session.close();
```

Keep the report private until you have reviewed it. Although values are excluded, paths and field names can still reveal which features were used.

## Important limitation

This hook currently instruments the AppState-backed personal-session bootstrap and requests. It does **not** capture a username/password login flow because native Facebook credential login is not implemented yet. It cannot manufacture the missing login trace or discover Facebook's private login protocol by itself. Do not paste cookies, AppState, passwords, tokens or 2FA codes into a report or chat.
