# ModuQR Roadmap

> Roadmap phases describe product scope, not release version numbers. ModuQR follows Semantic Versioning independently; see [`docs/VERSIONING.md`](docs/VERSIONING.md).

## Phase 1 — Foundation & Static QR Studio — Shipped in v0.1.0
The static foundation is included in the first public release: custom SVG renderer, image scanner, scan-safety v1, local projects, offline PWA, exports, accessibility and SEO.

## Phase 2 — Professional Designer — Implementation and validation complete
The Phase 2 implementation now contains neighbour-aware Connected/Fluid rendering, independent finder controls, per-region styling, advanced gradients/frames, 60 searchable/favoritable presets, Surprise Me, project tags/search/duplicate/history, design-only sharing, schema-v3 migration, mockups, Print Safety Assistant, Scan Safety v2 simulations/Auto Fix, camera/upload/drop scanner flows, Scan → Redesign, and a local 500-row CSV/TSV/JSON batch pipeline with Worker preparation, templates, ZIP/PDF exports and capacity analysis.

The Phase 2 acceptance gate passed on 2026-11-06: frozen-lockfile install, lint, typecheck, unit tests, production build, bundle budget, production dependency audit, CodeQL, accessibility smoke coverage, and the five-project Playwright matrix all passed. The E2E run reported 217 passed, 8 intentionally skipped, and zero flaky tests. The 500-row verified SVG ZIP acceptance test and offline service-worker smoke test each run once on desktop Chromium; their skips in the other four browser projects are intentional. PR #15 contains batch-export hardening and regression coverage; PR #16 fixes the WebKit batch-editor hydration race. Both are merged into the released main branch.

## Phase 3 — Dynamic & Developer Platform — Next
Architecture is documented in [`docs/architecture/PHASE3-DYNAMIC-PLATFORM.md`](docs/architecture/PHASE3-DYNAMIC-PLATFORM.md); implementation has not shipped. Planned scope includes optional PostgreSQL server mode, dynamic redirects, privacy-respecting analytics, REST/OpenAPI, API keys, SDK/React/CLI/embed/MCP packages and Docker self-hosting. Static generation must remain server-independent.

Each phase is gated by regression, accessibility, performance, dependency and security audits.
