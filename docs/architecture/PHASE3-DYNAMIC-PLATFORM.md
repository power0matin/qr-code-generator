# Phase 3 — Dynamic & Developer Platform

**Status:** Architecture proposal. No server feature is shipped by this document.

Phase 3 adds an optional hosted/self-hosted dynamic-link platform. It must not change the privacy, availability, or deployment requirements of the existing static QR Studio.

## 1. Product boundary

### Static mode remains independent

- Static QR payload encoding, SVG rendering, scanning, export, presets, and IndexedDB projects continue to run in the browser.
- The web app must build and run with the API and PostgreSQL completely unavailable.
- No static payload, WiFi credential, logo, scanner image, or local project is uploaded to the API.
- The static generator must not call the API as a hidden fallback.
- Static QR routes remain usable on a static-only deployment.

### Dynamic mode is explicitly opt-in

A dynamic QR code encodes a stable ModuQR redirect URL. The server maps its opaque code to a validated destination and returns a temporary redirect. Changing a destination changes the target of the same QR code; it does not require regenerating the printed QR.

The product must label a dynamic link as server-dependent and distinguish it from a static QR at creation, preview, export, and documentation time.

### Non-goals for the first server release

- Server-side generation or rendering of static QR images.
- Uploading or storing QR artwork, logo assets, or local project documents.
- User tracking profiles, advertising identifiers, browser fingerprinting, or raw clickstream retention.
- Public anonymous link creation without an API key.
- Arbitrary redirect schemes such as `javascript:`, `data:`, `file:`, or custom executable handlers.
- An SDK, CLI, MCP server, or React package before the HTTP contract is stable.

## 2. Proposed deployment topology

```text
Browser
  ├── Static Studio (Next.js, no API dependency)
  └── Dynamic link management (optional API client)
             │ HTTPS
             ▼
        Reverse proxy
        ├── TLS termination
        ├── request-size limits
        ├── basic IP/route rate limits
        └── security headers
             │
             ▼
        apps/api (Node.js + TypeScript)
        ├── versioned REST API
        ├── API-key authentication
        ├── dynamic redirect handler
        ├── link-management service
        ├── aggregated analytics writer
        └── health/readiness endpoints
             │
             ▼
        PostgreSQL
        ├── tenants
        ├── API keys (hashes only)
        ├── dynamic links
        ├── idempotency records
        └── aggregated click counters
```

### Runtime decisions

- Add `apps/api` as a separate workspace app. Keep the existing `apps/web` runtime and deployment unchanged.
- Use the existing TypeScript toolchain and strict compiler settings.
- Phase 3A uses Node's built-in HTTP server for its deliberately small health-only surface. Introduce Fastify or another framework when the authenticated management contract arrives in Phase 3B/3C and justifies a framework dependency.
- Use PostgreSQL as the durable source of truth. Keep the first implementation free of a mandatory Redis dependency.
- The foundation uses PostgreSQL client utilities for bounded readiness queries and explicit migration execution; it adds no third-party runtime npm dependencies.
- Put SQL migrations under the API app and run them as an explicit release step/one-off container command. Do not run concurrent schema migrations independently from every API replica.
- Share request/response validation and OpenAPI definitions through a dedicated `packages/api-contracts` package. Do not put server-only persistence or secrets in `packages/shared`.
- The redirect service must not depend on `@moduqr/core` or `@moduqr/renderer`.

Framework, migration runner, and PostgreSQL driver versions must be selected and locked in the implementation PR after a clean install and compatibility review. This proposal intentionally does not invent unverified package versions.

## 3. Tenant and API-key model

The data model should support isolated tenants even if the first self-hosted deployment bootstraps only one owner tenant.

### API key requirements

- Keys are generated from a cryptographically secure random source with at least 256 bits of entropy.
- Display the full secret once at creation. Never store or return the raw secret again.
- Store a key identifier/prefix for lookup and a SHA-256 digest of the random secret for verification. Because the secret is high entropy, password-style slow hashing is not required; an optional server-side pepper may be added if operational secret management is available.
- Store scopes, tenant ID, creation time, optional expiry, last-used time, and revocation time.
- Support key rotation and immediate revocation.
- Require `Authorization: Bearer <key>`. Never accept API keys in query parameters or URL paths.
- Redact Authorization headers and secret material from application, proxy, and error logs.
- Compare candidate digests in constant time where comparison occurs in application code.
- Enforce tenant ownership in every query and mutation; a UUID or link code is not authorization.

Suggested initial scopes:

| Scope | Permissions |
|---|---|
| `links:read` | Read links owned by the tenant |
| `links:write` | Create and update dynamic links |
| `links:delete` | Disable/delete owned links |
| `analytics:read` | Read aggregate analytics |
| `keys:manage` | Create, list, rotate, and revoke API keys |

The first release may provision an owner tenant and its first key through a local CLI/bootstrap command. Public signup, billing, and account recovery are separate product decisions.

## 4. Dynamic-link lifecycle

### Code generation

- Use an opaque, non-sequential code from a cryptographically secure random source.
- Start with at least 96 bits of entropy; prefer 128 bits if the URL length remains acceptable.
- Enforce a database unique constraint and retry on collision. Never rely on an application-only uniqueness check.
- Do not encode tenant IDs, database IDs, timestamps, or sequential counters in public codes.
- A custom alias feature is out of the initial scope; it needs reserved-word, abuse, and race-condition handling.

### Destination validation

Accept only absolute `http:` and `https:` URLs for the first release.

Reject:

- Missing host, malformed URLs, control characters, embedded credentials, unsupported schemes, and excessively long destinations.
- Loopback, link-local, private, multicast, and other non-public literal IP destinations.
- ModuQR's own redirect origin when it would create a redirect loop.
- Values that parse differently across validation and redirect code paths.

Normalize with the platform URL parser and store the canonical serialized URL. The redirect service must never fetch the destination while creating or resolving a link. Destination validation is not a server-side URL preview and must not introduce an SSRF-capable fetch path.

For domains that resolve to private addresses, an implementation must document the remaining DNS-resolution limitations; do not claim that a literal-IP check prevents every browser-side navigation to private network hosts.

### Link states and redirect behavior

Initial states:

- `active`: returns a temporary redirect to the current destination.
- `disabled`: returns a non-success response and does not redirect.
- `expired`: treated as inactive once `expires_at` has passed.

Use a temporary redirect (302 by default) so browsers and QR scanners do not permanently cache a destination that an owner may later change. Never use a permanent redirect for editable links in the initial release.

A disabled, deleted, expired, or unknown code must not disclose tenant details or whether another tenant owns a matching internal record.

## 5. Initial HTTP contract

All management endpoints are versioned under `/v1`. Responses use a consistent JSON error envelope with a stable machine-readable code and request ID. Validation errors must not echo secret values.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health/live` | Public | Process liveness only |
| GET | `/health/ready` | Public | Readiness including database connectivity |
| POST | `/v1/links` | `links:write` | Create a dynamic link |
| GET | `/v1/links` | `links:read` | List tenant-owned links with cursor pagination |
| GET | `/v1/links/{id}` | `links:read` | Read one tenant-owned link |
| PATCH | `/v1/links/{id}` | `links:write` | Update destination, expiry, or status |
| DELETE | `/v1/links/{id}` | `links:delete` | Disable a link; do not hard-delete history by default |
| GET | `/v1/links/{id}/analytics` | `analytics:read` | Read aggregate click counts |
| POST | `/v1/api-keys` | `keys:manage` | Create a scoped key; show secret once |
| GET | `/v1/api-keys` | `keys:manage` | List key metadata, never secrets |
| DELETE | `/v1/api-keys/{id}` | `keys:manage` | Revoke a key |

Public redirect route:

- `GET /r/{code}` resolves an active, unexpired link and returns a 302 redirect.
- `HEAD /r/{code}` returns the same status and headers without recording a click unless a later contract explicitly defines otherwise.
- Redirect responses use `Cache-Control: no-store` initially. Any caching policy must be deliberate because destination updates and revocation must take effect predictably.
- Do not accept a client-supplied `url`, `next`, or `redirect` parameter on the redirect route.

### Create-link request (illustrative)

```json
{
  "destinationUrl": "https://example.com/campaign",
  "expiresAt": null,
  "metadata": {
    "label": "Campaign poster"
  }
}
```

The response returns the internal link ID, opaque public code, canonical short URL, normalized destination, state, and timestamps. `metadata` is optional, size-limited, and must not become a place for secrets or arbitrary uploaded documents.

### Idempotency

Support an `Idempotency-Key` header for create operations. Persist the tenant, key, request-body digest, result reference, and expiry. Reusing a key with a different request body returns a conflict. This prevents accidental duplicate links when clients retry after a network timeout.

## 6. PostgreSQL schema proposal

All timestamps are UTC `timestamptz`. Use foreign keys, check constraints, explicit indexes, and tenant-scoped queries. The exact SQL belongs in migration files and is reviewed separately.

### `tenants`

- `id` UUID primary key
- `name`
- `status` (active/disabled)
- `created_at`, `updated_at`

### `api_keys`

- `id` UUID primary key
- `tenant_id` foreign key
- `prefix` (non-secret lookup identifier)
- `secret_hash` (unique digest; never raw token)
- `scopes` (validated set)
- `created_at`, `last_used_at`, `expires_at`, `revoked_at`

Index the active key lookup fields. Key listing must never expose `secret_hash`.

### `dynamic_links`

- `id` UUID primary key
- `tenant_id` foreign key
- `code` unique public identifier
- `destination_url` canonical HTTP(S) URL
- `label` nullable, bounded length
- `status` (active/disabled)
- `expires_at` nullable
- `created_at`, `updated_at`, `deleted_at` nullable

Indexes: unique `code`, `(tenant_id, created_at DESC, id)`, and any measured lookup needed for active/expiry queries.

### `idempotency_records`

- `tenant_id`, `idempotency_key` composite unique key
- `request_hash`
- `resource_id`
- `response_status` and bounded response metadata
- `created_at`, `expires_at`

Do not store bearer secrets or full unbounded response bodies in this table.

### `link_clicks_daily`

- `tenant_id`, `link_id`, `day` composite primary key
- `click_count` non-negative integer/bigint
- `updated_at`

Use atomic upserts to increment counts. Store no raw IP address, full user-agent, fingerprint, or per-click identifier in the first release. Analytics initially expose total clicks and daily counts only. Country, referrer, device category, and similar breakdowns require a separate privacy review and must not be inferred without a trustworthy data source.

Retention policy for aggregate analytics must be documented. Link deletion and tenant deletion must define whether aggregate counts are removed or retained in anonymized form before implementation.

## 7. Privacy and security controls

- Keep payload generation and static-project storage client-side.
- Require TLS for API keys and redirect-management operations in production.
- Use request-body size limits and strict schema validation.
- Rate-limit link creation and mutation by API key/tenant, plus coarse per-IP controls at the reverse proxy.
- Add redirect abuse controls: tenant quotas, link disable/revoke, destination validation, and operational abuse reporting.
- Apply tenant scoping at the service/repository boundary; never accept a tenant ID from an untrusted request body as authority.
- Use generic responses for unknown and non-owned link IDs to prevent cross-tenant enumeration.
- Set restrictive security headers and avoid caching authenticated management responses.
- Ensure logs contain request IDs and operational status but not API tokens, full click identifiers, or sensitive destination query strings by default.
- Run dependency audit and CodeQL as required CI gates.
- Back up PostgreSQL, test restore procedures, and document migration rollback/forward-fix policy before production launch.

Rate-limiting storage and multi-instance coordination must be decided before horizontal scaling. The first version can combine proxy-level limits with per-tenant quotas; do not introduce a mandatory Redis service until measured traffic or deployment requirements justify it.

## 8. Analytics behavior

A redirect should remain fast and should not wait for a multi-step analytics pipeline. The first implementation may increment a daily aggregate in a bounded database operation after the link is resolved. If analytics write failure occurs, the redirect must still complete; failures are logged with a request ID and counted operationally without exposing destination data.

Do not claim exact real-human scans. The metric is a count of redirect requests, which may include previews, bots, and automated scanners. Label it accordingly in the UI and API.

## 9. Deployment and operations

The self-hosted server stack is optional and separate from the static web deployment.

Proposed Compose services:

- `web`: existing Next.js static studio
- `api`: dynamic link API/redirect service
- `postgres`: persistent relational database
- reverse proxy: TLS, routing, request limits, and rate limiting

Required operations:

1. Validate required environment variables at startup without printing secrets.
2. Use separate migration and runtime database credentials where practical.
3. Run migrations once before starting new API replicas.
4. Use a non-root API container, read-only filesystem where feasible, and bounded CPU/memory.
5. Provide liveness and database-backed readiness endpoints.
6. Define database backup, restore, retention, and upgrade procedures.
7. Document how to disable dynamic features without affecting static Studio routes.
8. Support a static-only deployment with no PostgreSQL, API container, or API environment variables.

Environment variables should be documented in a dedicated server example file. No secrets or production credentials belong in the repository.

## 10. Delivery sequence and acceptance gates

### Phase 3A — API foundation

- Add `apps/api` and API-only configuration.
- Add database connectivity, explicit migrations, liveness/readiness, structured redacted logs, and Docker development support.
- Add integration tests against a real PostgreSQL service in CI.
- Prove the static web build and browser suite still pass with the API disabled.

**Acceptance:** clean frozen install, lint, typecheck, unit/integration tests, API build, container build, migrations from empty DB, readiness failure when DB is unavailable, and no static app regression.

### Phase 3B — Tenant and API-key security

- Bootstrap one tenant for self-hosted deployments.
- Issue random API keys, store digests only, enforce scopes, expiry, rotation, revocation, and tenant ownership.
- Add rate limits and idempotency records.

**Acceptance:** tests for invalid/expired/revoked keys, scope denial, tenant isolation, token redaction, key rotation, idempotency replay and request mismatch.

### Phase 3C — Dynamic links and redirects

- Implement create/list/read/update/disable operations.
- Generate opaque codes with database-enforced uniqueness.
- Validate destinations and implement 302 redirects with no-store semantics.
- Build the first minimal web UI for creating and managing dynamic links.

**Acceptance:** test active/disabled/expired/unknown codes, destination changes, redirect loops, unsafe schemes, credentials, malformed URLs, tenant isolation, and behavior when PostgreSQL is unavailable.

### Phase 3D — Privacy-respecting analytics

- Record aggregate daily redirect counts without storing raw per-click identifiers.
- Expose analytics API and minimal charts.
- Define deletion/retention behavior and label counts as redirect requests, not guaranteed human scans.

**Acceptance:** analytics aggregation correctness, write failure does not break redirects, no raw IP/user-agent persistence, tenant isolation, and retention tests.

### Phase 3E — Developer platform

- Publish OpenAPI from the same schemas used at runtime.
- Add API documentation and examples.
- Only after the contract has stabilized, add SDK, React helper, CLI, embed, and MCP integrations as separate packages.

**Acceptance:** OpenAPI contract tests, compatibility policy, package smoke tests, examples using real API responses, and independent release/versioning rules.

## 11. Release gate

No Dynamic QR route should be presented as a shipped feature until the API, database migrations, redirect behavior, security tests, privacy controls, deployment documentation, and operational restore procedure all pass. The current `/dynamic-qr-code` roadmap page must remain non-indexed and must not imply that Dynamic QR is available before that gate.

The Phase 3 implementation must be reviewed as an additive service. It must not weaken the privacy boundary or availability of the static-only product.
