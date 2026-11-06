# Versioning Policy

ModuQR follows [Semantic Versioning](https://semver.org/) for releases. Product roadmap phases are intentionally independent from version numbers.

## Current release

The first public release is `v0.1.0` (2026-11-06). It ships the static QR web application only. The Dynamic server platform, redirects, API and analytics are not included. Root, web app and all workspace package manifests use the same version. Workspace packages are private implementation modules; this release does not publish them to npm.

## Pre-1.0 releases

While ModuQR is still defining public package APIs, project schemas and the optional server platform:

- `0.MINOR.0` — meaningful feature sets, architecture changes or intentionally breaking pre-1.0 API changes.
- `0.MINOR.PATCH` — compatible bug fixes, security fixes and small maintenance releases.
- `0.MINOR.0-alpha.N` — early public preview when the feature set is incomplete.
- `0.MINOR.0-beta.N` — feature-complete preview that still needs broader validation.
- `0.MINOR.0-rc.N` — release candidate with no planned feature changes before the final release.

Examples: `0.2.0`, `0.2.1`, `0.3.0-beta.1`, `0.3.0-rc.1`.

Because SemVer treats `0.x` APIs as unstable, any breaking change before `1.0.0` must still be documented clearly in the changelog and migration notes. Incrementing the minor version is preferred for breaking pre-1.0 changes.

## When 1.0.0 is justified

`1.0.0` is not a synonym for “Phase 1 complete” or “all roadmap phases complete.” It is a compatibility commitment. Tag `1.0.0` only when all of the following are true:

1. The static QR studio is production-stable and its scanability/export contracts are proven by the release gate.
2. Public package APIs and the versioned design/project schema have documented compatibility and migration policies.
3. Any shipped server mode is operationally documented, upgradeable and free of placeholder contracts.
4. Security, privacy, accessibility, browser compatibility and self-hosting claims in the README match tested behavior.
5. Maintainers are prepared to treat breaking public API/schema changes as future major-version events.

This means `1.0.0` may happen before every long-term roadmap idea is implemented, or after several `0.x` releases. Stability determines the version, not the phase number.

## Release procedure

Every release is prepared through a pull request:

1. Finish and document the intended scope; keep unreleased roadmap work out of the release.
2. Set the root, web app and every workspace package to the same exact SemVer version.
3. Move completed entries from `[Unreleased]` into a dated `CHANGELOG.md` section.
4. Add curated release notes at `docs/releases/v<version>.md`.
5. Open and merge the release PR into `main`. The release workflow is triggered by the new release-notes file (or can be rerun manually).
6. The workflow performs a frozen install, validates every package version and the release-notes file, runs lint, typecheck, unit tests, production build, bundle budget, production dependency audit and the full Playwright matrix.
7. Only after validation succeeds, the workflow creates an annotated `v<version>` tag at the validated `main` commit, creates a reproducible source archive, writes its SHA-256 checksum and publishes the GitHub Release.
8. Verify the release page, tag target and downloadable assets.

The publish job is idempotent for reruns: it reuses an existing tag only when it points to the exact validated commit, and updates the matching release assets instead of silently moving a tag.

Never create a tag merely because a roadmap phase number changed. A roadmap milestone is not a versioning event.
