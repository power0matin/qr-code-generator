# Changelog

All notable changes follow Keep a Changelog and Semantic Versioning.

## [Unreleased]

### Added
- pnpm monorepo with separated web, core, renderer, preset, scan-validation, and shared packages.
- Ten static payload types with Smart Detect parsing and editable structured inputs.
- ModuQR-owned SVG renderer with square, rounded, dot/circle, diamond, pixel, Connected, and Fluid module styles.
- Independent finder overrides and multi-stop module/background gradients.
- Sanitized PNG/JPEG/WebP/SVG logo support, center cutout, frames, and 24 data-defined presets.
- Deterministic Scan Safety scoring plus real browser-rasterized decode verification.
- SVG, PNG, JPEG, WebP, and PDF export with preflight and post-compression decode checks where applicable.
- Local image scanner, privacy-safe Scan → Redesign, IndexedDB projects, versioned JSON portability, PWA/offline behavior, SEO pages, accessibility checks, CI, CodeQL, and release gates.
- Design schema v2 with transparent migration from schema v1.

### Changed
- Added neighbour-aware Connected/Fluid rendering and richer Phase 2 finder/gradient controls.
- Kept finder patterns solid under module gradients to preserve locator reliability.
- Refined the home hero preview to use the real renderer without hard-coded preset or numeric safety claims.
- Local Playwright uses the system Chrome channel; CI retains the full managed Chromium/Firefox/WebKit matrix, and local QA can explicitly exercise the built production server without downloading managed browsers.
- Local project reopening now passes only an IndexedDB project ID between routes instead of duplicating the whole design in session storage.
- Production PWA registration warms the currently loaded Next.js static assets for stronger first-session offline behavior.
- Batch and Dynamic roadmap pages remain accessible but are `noindex` and omitted from the sitemap until they ship.
- Design tabs now use a keyboard-friendly roving tab stop with Arrow/Home/End navigation, and advanced range controls match the renderer/import schema limits.

### Fixed
- Replaced the removed Lucide GitHub brand export with a dependency-independent accessible repository icon.
- Added real web-package unit coverage for public URL/repository normalization so the workspace test command no longer fails on an empty Vitest suite.
- Moved the web Vitest config to native ESM (`vitest.config.mjs`) to avoid the CommonJS/ESM config-loader warning.
- Made project and Scan → Redesign session handoffs resilient to React development remounts by consuming session storage only after the handoff is successfully applied.
- Added explicit accessible names to scanner/render error regions and to WiFi security/password controls so browser tests and assistive technology can target the intended controls without colliding with Next.js route announcers, option text, or helper copy.
- Prevented over-capacity payloads from crashing the Studio and blocked export when encoding fails.
- Preserved favorites across project load/edit/save and resolved IndexedDB writes only after transaction commit.
- Prevented stale scanner operations from overwriting newer results, validated raster dimensions before browser image decoding, and stripped URL credentials from explicit external-open targets.
- Hardened phone, WiFi, vCard, geolocation, WhatsApp, and iCalendar parsing/serialization edge cases.
- Kept visual frames fully outside the QR square and quiet zone.
- Expanded logo cutout geometry to account for the complete logo box, including padding and border footprint.
- Expanded Safety checks to include inherited/custom finder contrast and full logo-footprint risk without incorrectly treating raster export resolution as reduced obstruction.
- Fixed strict TypeScript, React Hooks, accessibility, color-contrast, local Playwright, and Windows Corepack issues found during QA.
- Guarded same-tab project/redesign handoff when session storage is unavailable instead of allowing storage exceptions to break the UI.
- Made development service-worker cleanup one-time per tab so stale caches are removed without breaking local offline tests after reload.
- Enabled HSTS and `upgrade-insecure-requests` only for a configured HTTPS public origin, preserving local production/CI testing over HTTP.
- Normalized public metadata origins and repository links and removed obsolete OpenGraph SVG artwork.

### Security
- Centralized raster signature/dimension inspection across design imports, logo uploads, scanner inputs, and renderer runtime defenses.
- Validated uploaded raster signatures and sanitized SVGs through an explicit tag/attribute allowlist.
- Revalidated imported design JSON, colors, logo MIME/data pairs, raster dimensions, and SVG references before loading.
- Added renderer-level defense in depth for unsafe runtime paint/logo values and oversized raster-logo dimensions.
- Tightened production CSP, Referrer-Policy, `nosniff`, frame protection, Permissions-Policy, COOP, and CORP; HTTPS-only headers are conditional on an HTTPS public origin.
- Release and CI installs use the committed lockfile with `--frozen-lockfile`; release verification also runs the production dependency audit, and CI uses bounded job timeouts with stale-run cancellation.

### Tests
- Added regressions for schema migration/import safety, payload edge cases, QR capacity failure, favorite persistence, logo MIME/SVG hardening, logo-padding cutout behavior, resolution-invariant obstruction scoring, frame/quiet-zone separation, finder/gradient contrast, runtime renderer hardening, PWA behavior, roadmap `noindex`, keyboard tab navigation, and responsive overflow.
- Browser QA covers renderer→scanner round trips, all shipped presets, advanced styles, exports, accessibility, and mobile/desktop behavior.

> The first public release, `v0.1.0`, remains gated on a clean install from the committed lockfile and the complete lint, typecheck, unit, production-build, browser, accessibility, dependency-audit, and security acceptance matrix. Roadmap phase numbers do not determine SemVer major versions.
