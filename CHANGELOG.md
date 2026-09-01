# Changelog

All notable changes follow Keep a Changelog and Semantic Versioning.

## [Unreleased]


### Fixed — final local QA cleanup
- fixed the `useSyncExternalStore` server snapshot type so the theme toggle remains strictly typed as `Theme`.
- declared the root document scroll behavior explicitly for Next.js route-transition handling, removing the development warning without changing the existing smooth-scroll UX.


### Fixed — QA follow-up
- resolved strict React/ESLint failures caused by synchronous state updates in effects and unstable keyboard callback ordering.
- fixed mobile toolbar accessibility by giving icon-only actions explicit accessible names.
- raised inactive designer-tab contrast above the WCAG 2.2 AA threshold in both themes.
- updated Phase 2 gradient E2E selectors to the current `Module gradient` control and added a stable decode-status accessibility hook.
- kept finder patterns solid when module gradients are enabled and darkened the default module-gradient palette to improve decoder reliability.
- allowed React development-only `unsafe-eval` in the local CSP while keeping the production CSP strict.
- removed the remaining privacy-page and PostCSS lint violations.


### Fixed
- local Playwright E2E now uses the system-installed Google Chrome channel, avoiding mandatory browser-binary downloads on networks where the Playwright CDN is unavailable; CI still exercises Chromium, Firefox, WebKit, and mobile emulation.

### Fixed
- fixed strict TypeScript environment-variable access under `noPropertyAccessFromIndexSignature`.
- fixed `exactOptionalPropertyTypes` compatibility in the payload editor field error contract.
- made Playwright local startup work without a globally enabled `pnpm` shim by using Corepack, while CI continues to run the production server after its build step.
- made root workspace scripts Corepack-safe on Windows when `corepack enable` cannot write to `Program Files`.

### Added — Phase 2 foundation
- neighbour-aware `Connected` and `Fluid` module rendering in the custom SVG engine.
- independent top-left, top-right, and bottom-left finder shape/color overrides with global inheritance.
- multi-stop linear/radial module gradients plus independent background gradients.
- Scan Safety checks for custom finder contrast and module/background gradient combinations.
- design document schema v2 with transparent migration of existing schema v1 local projects.
- Playwright regression coverage for neighbour-aware modules, per-finder overrides, and advanced gradients.

### Changed
- corrected the home hero QR preview to use a square, frameless renderer output with explicit responsive sizing.
- reduced the hero QR footprint and removed the crop risk caused by embedding a framed SVG inside the compact preview card.

### Added
- pnpm monorepo with `apps/web` and separated core/renderer/preset/scan-validation/shared packages.
- Ten Phase 1 static payload types and Smart Detect parsing.
- Custom SVG rendering, 24 presets, logos, gradients, finder styles and initial frames.
- Deterministic Scan Safety v1 plus real rendered decode verification.
- SVG/PNG/JPEG/WebP/PDF export with preflight and post-compression checks where applicable.
- Local image scanner, safe URL preview and privacy-safe Scan → Redesign.
- IndexedDB projects with search, favorite, duplicate, rename, delete and versioned JSON portability.
- Light/dark/system themes, PWA/offline infrastructure, SEO landing pages and security headers.
- Vitest/Playwright/axe test definitions, responsive matrix, CI, CodeQL, Dependabot and release gates.

### Fixed during audit
- Structured Smart Detect now populates editable WiFi/vCard/calendar fields.
- iCalendar compact dates convert into editable `datetime-local` values.
- WhatsApp API links recover the actual phone parameter.
- URL mode rejects non-HTTP(S) schemes.
- QR encoder border handling is compatible with `qr@0.6.0` while preserving renderer-owned quiet zones.
- Transparent and framed raster exports preserve the SVG aspect ratio and verification behavior.
- Scan → Redesign keeps decoded content out of the query string.

> The first public release, `v0.1.0`, remains gated on a clean dependency install and the complete CI/browser acceptance matrix. Roadmap phase numbers do not determine SemVer major versions.
