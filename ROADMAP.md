# ModuQR Roadmap

> Roadmap phases describe product scope, not release version numbers. ModuQR follows Semantic Versioning independently; see docs/VERSIONING.md.

## Phase 1 — Foundation & Static QR Studio — Shipped in v0.1.0

The static foundation is included in the first public release: custom SVG renderer, image scanner, scan-safety v1, local projects, offline PWA, exports, accessibility and SEO.

## Phase 2 — Professional Designer — Implementation and validation complete

The Phase 2 implementation contains neighbour-aware Connected/Fluid rendering, independent finder controls, per-region styling, advanced gradients/frames, 60 searchable/favoritable presets, Surprise Me, project tags/search/duplicate/history, design-only sharing, schema-v3 migration, mockups, Print Safety Assistant, Scan Safety v2 simulations/Auto Fix, camera/upload/drop scanner flows, Scan → Redesign, and a local 500-row CSV/TSV/JSON batch pipeline with Worker preparation, templates, ZIP/PDF exports and capacity analysis.

The Phase 2 acceptance gate passed on 2026-11-06: frozen-lockfile install, lint, typecheck, unit tests, production build, bundle budget, production dependency audit, CodeQL, accessibility smoke coverage, and the five-project Playwright matrix all passed. The E2E run reported 217 passed, 8 intentionally skipped, and zero flaky tests. PR #15 contains batch-export hardening and regression coverage; PR #16 fixes the WebKit batch-editor hydration race. Both are merged into the released main branch.

## Phase 3 — Dynamic & Developer Platform — In progress

Architecture is documented in docs/architecture/PHASE3-DYNAMIC-PLATFORM.md. Phase 3 is additive: static mode must remain useful without the API or PostgreSQL.

### Phase 3A — API foundation — Completed and merged

- Independent Node.js/TypeScript API workspace.
- PostgreSQL connection configuration and bounded database-backed readiness.
- Liveness independent from database status.
- Structured JSON logs with a strict operational-field allowlist.
- Transactional, advisory-locked, checksum-verified SQL migration runner.
- Optional Docker Compose stack with persistent PostgreSQL storage and a one-shot migration service.
- Unit tests plus a real-PostgreSQL integration gate in CI.
- Static web build and browser acceptance remain independent of the API.

Phase 3A was merged in [PR #18](https://github.com/power0matin/qr-code-generator/pull/18) on 2026-11-06 (squash commit `493af9e`). The full acceptance gate passed: frozen install, lint, typecheck, unit tests, workspace production build, bundle budget, production dependency audit, release metadata verification, PostgreSQL integration from a fresh service (including migration idempotency and checksum-tamper rejection), production API container build, runtime ESM import smoke test, Compose validation, CodeQL, and the full five-project Playwright matrix. The strict E2E report gate also passed with zero unexpected tests and zero retry-flaky tests. See [CI run #86](https://github.com/power0matin/qr-code-generator/actions/runs/42288196004) and [CodeQL run #95](https://github.com/power0matin/qr-code-generator/actions/runs/42288195937).

Phase 3A is an optional server foundation only. It does not ship tenant authentication, API keys, dynamic link CRUD, public redirects, analytics, a management UI, or a production deployment; those remain subsequent phases.

### Phase 3B — Tenant and API-key security — Implementation in progress

The Phase 3B branch adds the security foundation without implementing dynamic links:

- One-time bootstrap command for the initial tenant; no public signup endpoint.
- High-entropy API key secrets with hash-only persistence and strict Bearer parsing.
- Explicit scopes, bounded expiry, key listing, atomic rotation and revocation.
- Tenant-scoped management queries and fixed-window per-key rate limiting.
- Tenant-scoped idempotency reservations bound to operation and request hash.
- Real PostgreSQL integration tests for tenant isolation, key lifecycle, replay conflicts and rate-limit behavior.

The management surface is limited to `/v1/api-keys`. Key creation/rotation secrets are returned once and are never replayed or stored in idempotency metadata. Expired idempotency records are pruned before new reservations for the same tenant.

Acceptance requires frozen install, lint, typecheck, unit tests, production build, PostgreSQL integration, runtime container load, Compose validation, CodeQL and no static web regression. The current implementation is under review in a dedicated branch; it is not yet merged or deployed.

### Phase 3C — Dynamic links and redirects

Create/list/read/update/disable operations, opaque public codes, destination validation, temporary redirects, and the first minimal management UI.

### Phase 3D — Privacy-respecting analytics

Daily aggregate redirect-request counts, tenant-scoped analytics APIs, retention/deletion policy and minimal charts. Counts must not be described as guaranteed human scans.

### Phase 3E — Developer platform

OpenAPI generated from runtime contracts, API documentation and examples. SDK, React helper, CLI, embed and MCP integrations follow only after the HTTP contract is stable.

Each phase is gated by regression, accessibility, performance, dependency, privacy, security and operational reviews.
