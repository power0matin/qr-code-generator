# ModuQR Roadmap

> Roadmap phases describe product scope, not release version numbers. ModuQR follows Semantic Versioning independently; see docs/VERSIONING.md.

## Phase 1 — Foundation & Static QR Studio — Shipped in v0.1.0

The static foundation is included in the first public release: custom SVG renderer, image scanner, scan-safety v1, local projects, offline PWA, exports, accessibility and SEO.

## Phase 2 — Professional Designer — Implementation and validation complete

The Phase 2 implementation contains neighbour-aware Connected/Fluid rendering, independent finder controls, per-region styling, advanced gradients/frames, 60 searchable/favoritable presets, Surprise Me, project tags/search/duplicate/history, design-only sharing, schema-v3 migration, mockups, Print Safety Assistant, Scan Safety v2 simulations/Auto Fix, camera/upload/drop scanner flows, Scan → Redesign, and a local 500-row CSV/TSV/JSON batch pipeline with Worker preparation, templates, ZIP/PDF exports and capacity analysis.

The Phase 2 acceptance gate passed on 2026-11-06: frozen-lockfile install, lint, typecheck, unit tests, production build, bundle budget, production dependency audit, CodeQL, accessibility smoke coverage, and the five-project Playwright matrix all passed. The E2E run reported 217 passed, 8 intentionally skipped, and zero flaky tests. PR #15 contains batch-export hardening and regression coverage; PR #16 fixes the WebKit batch-editor hydration race. Both are merged into the released main branch.

## Phase 3 — Dynamic & Developer Platform — In progress

Architecture is documented in docs/architecture/PHASE3-DYNAMIC-PLATFORM.md. Phase 3 is additive: static mode must remain useful without the API or PostgreSQL.

### Phase 3A — API foundation — Implementation prepared for review

- Independent Node.js/TypeScript API workspace.
- PostgreSQL connection configuration and bounded database-backed readiness.
- Liveness independent from database status.
- Structured JSON logs with a strict operational-field allowlist.
- Transactional, advisory-locked, checksum-verified SQL migration runner.
- Optional Docker Compose stack with persistent PostgreSQL storage and a one-shot migration service.
- Unit tests plus a real-PostgreSQL integration gate in CI.
- Static web build and browser acceptance remain independent of the API.

Acceptance requires a clean frozen install, lint, typecheck, unit tests, production build, PostgreSQL integration tests from an empty database, migration idempotency/checksum verification, container build, and no static-app regression. The implementation is not a dynamic-link product release.

### Phase 3B — Tenant and API-key security — Next

Bootstrap tenant ownership, cryptographically random API keys, hash-only secret storage, scopes, expiry, rotation, revocation, rate limits, tenant isolation and idempotency records.

### Phase 3C — Dynamic links and redirects

Create/list/read/update/disable operations, opaque public codes, destination validation, temporary redirects, and the first minimal management UI.

### Phase 3D — Privacy-respecting analytics

Daily aggregate redirect-request counts, tenant-scoped analytics APIs, retention/deletion policy and minimal charts. Counts must not be described as guaranteed human scans.

### Phase 3E — Developer platform

OpenAPI generated from runtime contracts, API documentation and examples. SDK, React helper, CLI, embed and MCP integrations follow only after the HTTP contract is stable.

Each phase is gated by regression, accessibility, performance, dependency, privacy, security and operational reviews.
