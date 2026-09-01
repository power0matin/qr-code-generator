# GitHub Repository Setup — ModuQR

This file is the source of truth for publishing the repository on GitHub.

## Repository identity

- **Repository name:** `qr-code-generator`
- **Product name:** `ModuQR`
- **Full product title:** `ModuQR — Advanced QR Code Generator, Designer & Scanner`
- **Default branch:** `main`
- **Visibility:** Public
- **License:** MIT
- **Primary language:** TypeScript
- **Package manager:** pnpm
- **Current package version:** `0.1.0`
- **Current release status:** pre-1.0 development; the first public tag is `v0.1.0` after every release gate passes.

## GitHub description

Use this description while the repository is pre-1.0:

> Modern open-source QR code generator, designer & scanner with custom SVG styling, logos, frames, scan-safety checks, local projects and PWA support. Privacy-first.

After Phase 3 is actually implemented and verified, the description may be expanded to:

> Modern open-source QR code generator, designer & scanner with custom styles, logos, frames, scan-safety testing, batch export, dynamic QR codes, analytics, REST API and PWA support. Privacy-first & self-hostable.

Do not advertise Phase 2 or Phase 3 capabilities before they exist in a tagged release.

## GitHub Topics — current shipped scope

Add these topics now:

- `qr-code`
- `qr-code-generator`
- `qrcode`
- `qr-generator`
- `qr-code-designer`
- `qr-code-scanner`
- `custom-qr-code`
- `wifi-qr-code`
- `vcard`
- `react`
- `nextjs`
- `typescript`
- `pwa`
- `svg`
- `privacy`
- `open-source`

## GitHub Topics — reserve for future releases

Only add these after the corresponding capability ships and is documented:

- `qr-code-styling`
- `dynamic-qr-code`
- `self-hosted`
- `rest-api`
- `batch-qr-code-generator`

## Homepage

Set the GitHub **Website** field to the production HTTPS deployment once a public demo exists. Until then, leave it empty rather than pointing to a placeholder.

## Repository features

Recommended settings:

- Enable **Issues**.
- Enable **Discussions** once contribution traffic justifies it.
- Enable **Projects** only if the roadmap is actively maintained there.
- Enable **Preserve this repository** if available for the organization/account.
- Enable **Private vulnerability reporting**.
- Enable **Dependabot alerts** and **Dependabot security updates**.
- Keep **Wiki** disabled while `/docs` is the source of truth.

## Branch protection for `main`

Require:

- Pull request before merging.
- At least one approving review once more than one maintainer is active.
- Dismiss stale approvals when new commits are pushed.
- Conversation resolution before merge.
- Required status checks from CI.
- CodeQL/security checks.
- Branch must be up to date before merge.
- No force pushes.
- No branch deletion.

For releases, merge only after the release gate documented in `docs/TESTING.md` is green.

## Merge strategy

Recommended:

- Enable **Squash merging**.
- Use Conventional Commit style for the final squash commit.
- Disable merge commits unless repository history later needs them.
- Rebase merging is optional; keep one primary strategy for consistency.

Commit prefixes:

- `feat:`
- `fix:`
- `refactor:`
- `perf:`
- `test:`
- `docs:`
- `chore:`

## Labels

Recommended initial labels:

- `bug`
- `feature`
- `enhancement`
- `documentation`
- `accessibility`
- `performance`
- `security`
- `privacy`
- `scanability`
- `renderer`
- `scanner`
- `export`
- `pwa`
- `good first issue`
- `help wanted`
- `needs reproduction`
- `blocked`
- `phase-1`
- `phase-2`
- `phase-3`

## Releases and versioning

Roadmap phases are not mapped to major versions. The repository follows Semantic Versioning based on compatibility and release scope, not on internal phase numbers.

- Current development version: `0.1.0`.
- First public release tag: `v0.1.0`, only after the complete release gate passes.
- Pre-1.0 feature releases: increment the minor version, for example `0.2.0`, `0.3.0`, and so on.
- Compatible bug/security fixes: increment the patch version, for example `0.2.1`.
- Public previews may use prerelease identifiers such as `0.3.0-alpha.1`, `0.3.0-beta.1`, and `0.3.0-rc.1`.
- `1.0.0` is reserved for a genuinely stable product with documented public APIs/schemas and compatibility expectations; it is not tied to Phase 1, 2, or 3.

Before creating any tag, update the root package version and changelog. The release workflow verifies that the Git tag exactly matches the root package version.

Do not create a release tag until the capabilities claimed by that release are implemented, documented and verified. See `docs/VERSIONING.md`.

## Social preview

Use a 1280×640 social preview based on the ModuQR visual identity. Keep the QR itself central and avoid claiming unshipped Phase 2/3 features in the artwork.

The application Open Graph asset currently lives under `apps/web/public/og.svg`; a repository-specific raster social preview can be generated when the final public branding is approved.

## About section checklist

Before making the repository public, confirm that the GitHub About panel has:

- Description matching the current shipped scope.
- Production demo URL only if it actually works.
- Current topics only.
- MIT license detected correctly.
- README rendered without broken local links/assets.

## Release-gate reminder

`v0.1.0` must not be tagged until clean install, lint, full semantic typecheck, unit tests, production build, browser E2E matrix, accessibility smoke tests, dependency/security audit and documented production verification all pass.
