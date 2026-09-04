# ModuQR Roadmap

> Roadmap phases describe product scope, not release version numbers. ModuQR follows Semantic Versioning independently; see [`docs/VERSIONING.md`](docs/VERSIONING.md).

## Phase 1 — Foundation & Static QR Studio
Release-candidate static generator foundation: custom SVG renderer, image scanner, scan-safety v1, local projects, offline PWA, exports, accessibility and SEO. Public release remains gated by the complete clean-install and browser/security QA matrix.

## Phase 2 — Professional Designer — Implementation complete, acceptance gate pending
The Phase 2 implementation now contains neighbour-aware Connected/Fluid rendering, independent finder controls, per-region styling, advanced gradients/frames, 60 searchable/favoritable presets, Surprise Me, project tags/search/duplicate/history, design-only sharing, schema-v3 migration, mockups, Print Safety Assistant, Scan Safety v2 simulations/Auto Fix, camera/upload/drop scanner flows, Scan → Redesign, and a local 500-row CSV/TSV/JSON batch pipeline with Worker preparation, templates, ZIP/PDF exports and capacity analysis.

Phase 2 does **not** become release-complete until the clean-install lint/typecheck/unit/build/a11y/E2E/browser matrix, 500-row batch acceptance run, dependency/security checks, performance/bundle audit and Phase 1 regressions are green.

## Phase 3 — Dynamic & Developer Platform — Next after Phase 2 gate
Optional PostgreSQL server mode, dynamic redirects, privacy-respecting analytics, REST/OpenAPI, API keys, SDK/React/CLI/embed/MCP packages and Docker self-hosting. Static generation must remain server-independent.

Each phase is gated by regression, accessibility, performance, dependency and security audits.
