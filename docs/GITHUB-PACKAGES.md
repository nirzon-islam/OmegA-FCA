# GitHub Packages distribution

The package is published as `@octopusworldpro-web/omega-fca` to GitHub Packages.

## Publishing

A change to the package manifest or lockfile on `public-package` runs
`.github/workflows/publish.yml`. The workflow installs with `npm ci`,
runs the test and syntax suites, then publishes using the repository-scoped
`GITHUB_TOKEN` with `packages: write`.

## Installing in OmegA-Goatbot

The bot repository uses this scoped registry mapping in `.npmrc`:

```ini
@octopusworldpro-web:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
always-auth=true
```

Set `NODE_AUTH_TOKEN` in the deployment environment to a GitHub token
that can read packages (classic PAT with `read:packages`, authorized for
the account/organization and package). Do not commit the token.

For GitHub Actions consumers, grant the OmegA-Goatbot repository access to
the package under the package's **Manage Actions access** settings, then
grant the workflow `packages: read`.

The FCA repository can be made private after the package is published.
Package installation still requires registry authentication; repository
visibility and package access are separate controls.
