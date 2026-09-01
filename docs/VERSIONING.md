# Versioning Policy

ModuQR follows [Semantic Versioning](https://semver.org/) for releases. Product roadmap phases are intentionally independent from version numbers.

## Current baseline

The repository starts at `0.1.0`. The first public Git tag will be `v0.1.0` only after the complete release gate passes. The initial commit may contain `0.1.0` in package manifests without creating a release tag.

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

For every release:

1. Finish and document the intended scope.
2. Run the complete release gate from a clean checkout.
3. Update `CHANGELOG.md`.
4. Set the root/package versions to the exact release version.
5. Commit the release metadata.
6. Create an annotated or signed Git tag named `v<version>`.
7. Push the tag; GitHub Actions verifies that the tag matches the root package version before creating the GitHub Release.

Never create a tag merely because a roadmap phase number changed.
