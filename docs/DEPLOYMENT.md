# Deployment and release checklist

This guide covers deployment of the **currently implemented official Meta Messenger Page webhook example**. It does not make this package a personal-account FCA replacement.

## Supported deployment target

- Node.js 20 or 22.
- A host that can run a long-lived Node.js web service (for example, Railway or Render).
- A trusted HTTPS ingress in front of the example's HTTP listener.
- A Meta app and Facebook Page configured for Messenger Platform.
- A Page access token and the permissions approved for the app.

## Required environment

Set these values in the hosting provider's secret/environment settings. Do not commit real values:

- `META_PAGE_ACCESS_TOKEN`
- `META_PAGE_ID`
- `META_GRAPH_API_VERSION` — a Graph API version supported by the Meta app.
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `PORT` — normally supplied by the hosting provider; the example defaults to 3000.

The example does not need the optional OmegA license or session-encryption variables to run the Page webhook transport.

## Build and start

The repository currently has no compile/build step and no runtime npm dependencies. From the repository root:

```bash
npm ci
npm test
npm run test:syntax
npm pack --dry-run
node examples/meta-messenger-server.js
```

Configure the hosting provider's start command as:

```bash
node examples/meta-messenger-server.js
```

Configure the health check path as `/healthz`. Configure Meta's webhook callback URL as `https://YOUR_DOMAIN/webhook`, with the exact same verify token as `META_WEBHOOK_VERIFY_TOKEN`. Subscribe the Page to the Messenger webhook fields required by the application.

## Network and security requirements

- Expose only HTTPS publicly. Terminate TLS at the hosting provider's trusted ingress and keep the Node HTTP listener private behind it.
- Preserve the original raw POST body. Do not parse/re-serialize JSON before signature verification.
- Do not log access tokens, app secrets, verify tokens, cookies, AppState, passwords, or 2FA material.
- Keep the service's environment variables in the provider's secret manager.
- Restrict access to deployment logs and rotate Page tokens if they are exposed.
- The example caps webhook request bodies at 1 MiB and returns a generic error response for invalid webhook requests.
- Configure provider-level restart and resource limits; this sample does not include a durable queue, database, or replay store.

## Release checks

The CI workflow runs on Node 20 and 22 and performs:

1. `npm test`
2. Recursive JavaScript syntax validation.
3. Root package export smoke test.
4. `npm pack --dry-run --json` to validate the package archive contents.

`prepublishOnly` repeats the unit tests and syntax validation before an npm publish command. This branch has not been published. Before publishing, confirm that the npm scope `@omega` is controlled by the project owner and that the intended package name/version are available.

## Not deploy-ready as personal-account FCA

The following capabilities are still absent and are hard blockers for replacing an existing FCA in GoatBot:

- Native personal-account authentication and AppState lifecycle.
- Personal-account HTTP/GraphQL actions and legacy FCA response normalization.
- Facebook realtime MQTT/WebSocket transport and event decoding.
- Full GoatBot call-site compatibility and authorized end-to-end integration tests.

Do not point an existing GoatBot deployment at this package as a drop-in replacement. Deploy the Page webhook example only for the Page-based features described above.