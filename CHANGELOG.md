# Changelog

All notable changes follow Keep a Changelog and Semantic Versioning.

## [Unreleased]

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
