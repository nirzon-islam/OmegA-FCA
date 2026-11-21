# OmegA-FCA prerelease publishing

Prereleases are published by the GitHub Actions workflow `.github/workflows/publish-npm-release.yml`. The workflow publishes only prerelease tags to npm's `next` dist-tag; it does not move the stable `latest` tag.

## Current prerelease candidate

- Package: `@nirzon-islam/omega-fca`
- Candidate version: `0.1.6-rc.4`
- Git tag / GitHub Release: `v0.1.6-rc.4`
- Registry: `https://registry.npmjs.org/`
- Dist-tag: `next`

## Required repository secret

Before running the publish workflow, configure the repository Actions secret:

- Name: `NPM_TOKEN`
- Value: an npm automation/access token with publish permission for `@nirzon-islam/omega-fca`

Do not commit the token, put it in workflow source, or paste it into chat or logs. The workflow uses GitHub's OIDC permission for npm provenance as well as `NPM_TOKEN` for registry authentication.

## Publish the existing rc.4 release

The GitHub Release `v0.1.6-rc.4` already exists. Because the publish workflow was added after that release was created, its `release: published` trigger will not run retroactively.

To publish this existing candidate:

1. Open the repository's **Actions** tab.
2. Select **Publish npm prerelease**.
3. Choose **Run workflow**.
4. Select branch `main`.
5. Enter tag `v0.1.6-rc.4`.
6. Start the workflow and wait for the `publish` job to finish successfully.

The workflow checks out the exact tag, installs from the lockfile, runs tests/type/syntax checks, verifies that the package version matches the prerelease tag, reviews the package contents with `npm pack --dry-run`, then publishes with `--tag next`.

For future GitHub prereleases, publishing starts automatically when a prerelease is published.

## Verify the published artifact

After the workflow succeeds, verify:

```sh
npm view @nirzon-islam/omega-fca@next version
npm view @nirzon-islam/omega-fca dist-tags
npm pack @nirzon-islam/omega-fca@next
```

Confirm that `next` resolves to `0.1.6-rc.4` and inspect the packed tarball. Only after that should GoatBot's `fca-migration-cleanup` dependency and lockfile be updated to the exact published version and tested with `npm ci`.

## Release boundary

A successful package build and synthetic CI do not prove Facebook login, MQTT event delivery, message sending, attachments, or private web actions work against Meta's live service. Those still require an authorized owner-controlled AppState acceptance run.

## Candidate scope

This rc.4 candidate updates the package and lockfile version metadata. It does not claim new protocol support or completion of the outstanding live Facebook/AppState acceptance gates.
