# ModuQR optional API

The API is an optional server-side platform. Static QR generation, scanning, local projects, exports and the PWA remain independent of this service.

Phase 3A supplied the Node.js health API and checksum-protected PostgreSQL migrations. Phase 3B adds tenant bootstrap, API-key authentication and lifecycle management. Dynamic links, public redirects, analytics and the management UI are not implemented by these phases.

## Runtime

- Node.js 22.14 or newer
- PostgreSQL 15 or newer
- `psql`, used for bounded readiness probes and the explicit migration runner
- A validated PostgreSQL `DATABASE_URL`

Postgres.js 3.4.9 is the API's async PostgreSQL driver. The pool is bounded to 10 connections, uses a five-second connection timeout and disables prepared statements for compatibility with transaction poolers. Runtime queries use fixed SQL statements and bound parameters. Database credentials and query errors are never written to application logs.

## Local development

From the repository root:

~~~bash
cp .env.api.example .env.api
# Replace POSTGRES_PASSWORD with a URL-safe random value.
docker compose --env-file .env.api -f compose.api.yaml up --build -d
curl http://127.0.0.1:4100/health/live
curl http://127.0.0.1:4100/health/ready
~~~

The Compose stack binds the API to loopback only. PostgreSQL is not published to the host. A one-shot migration container completes before the API starts. The named PostgreSQL volume persists across normal restarts.

To stop without deleting data:

~~~bash
docker compose --env-file .env.api -f compose.api.yaml down
~~~

Removing the named volume is destructive. Do not run that operation unless the local database can be discarded.

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| DATABASE_URL | Yes | — | PostgreSQL connection URL |
| HOST | No | 0.0.0.0 | HTTP bind address |
| PORT | No | 4100 | HTTP bind port |

Only PostgreSQL URLs are accepted. The current configuration supports a single `sslmode` URL parameter and rejects unknown options. Use an encrypted PostgreSQL connection for remote production databases. Never commit real credentials. The local Compose password is not a production secret-management strategy.

## Bootstrap the first tenant

Bootstrap is a one-time local/operational command. It is not an HTTP signup endpoint and only succeeds while no bootstrap-owner tenant exists.

~~~bash
docker compose --env-file .env.api -f compose.api.yaml run --rm api node dist/bootstrap.js "My Workspace"
~~~

This one-off command runs inside the Compose network, uses the API service's private database URL and does not publish a PostgreSQL host port. For a PostgreSQL instance reachable from the host, the equivalent workspace command is `DATABASE_URL=... pnpm --filter @moduqr/api bootstrap -- "My Workspace"`.

The command creates one active tenant and a 90-day owner API key. The full key is printed once to stdout. Store it immediately in a secret manager or another protected location. The database stores only the SHA-256 digest and public lookup prefix; the original secret cannot be retrieved. Do not paste the token into issue trackers, chat, shell history, CI output or logs.

Bootstrap is serialized by a PostgreSQL advisory transaction lock and a partial unique index. Running it again fails without creating another owner tenant.

## Health contract

| Method | Path | Meaning |
| --- | --- | --- |
| GET, HEAD | /health/live | The HTTP process is alive; it does not contact PostgreSQL |
| GET, HEAD | /health/ready | PostgreSQL accepts a bounded `SELECT 1` query |

Readiness returns 503 when PostgreSQL is unavailable, authentication fails, `psql` is missing or the probe times out. Liveness remains independent so an unavailable database does not cause a healthy process to be restarted repeatedly.

## API key security

API keys use the format `mqk_live_<prefix>.<secret>`. The prefix is a lookup identifier; the 256-bit random secret is the credential. Each request must send the key in the `Authorization: Bearer` header. Query-string and body-based credentials are not accepted.

The database stores the prefix, SHA-256 secret digest, tenant ID, scopes, created/expiry/last-used/revocation timestamps. It never stores the raw token. Treat `keys:manage` as tenant-administrator privilege: it can issue any supported scope and manage all keys within that tenant. The API prevents revoking or downgrading the last active `keys:manage` key; rotate it to a replacement that retains that scope instead. Authentication performs a constant-time digest comparison, checks tenant status and expiry, and updates last-use metadata at most once per minute.

Supported scopes:

- `links:read`
- `links:write`
- `links:delete`
- `analytics:read`
- `keys:manage`

The Phase 3B management routes are:

| Method | Path | Required scope | Purpose |
| --- | --- | --- | --- |
| GET | /v1/api-keys | keys:manage | List keys belonging to the authenticated tenant |
| POST | /v1/api-keys | keys:manage | Create a scoped key |
| POST | /v1/api-keys/{id}/rotate | keys:manage | Atomically revoke a key and issue its replacement |
| DELETE | /v1/api-keys/{id} | keys:manage | Revoke a key |

Create and rotate responses contain the new token once. Listing never returns a token or digest. Expiry defaults to 90 days; explicit expiry may be up to 365 days in the future, and `null` means no expiry. A revoked key cannot be reactivated. Rotation revokes the previous key and persists its replacement in a single transaction.

Every authenticated key is limited to 60 requests per fixed one-minute window. The response carries standard rate-limit headers; excess requests receive 429 and a `Retry-After` value. The window counter is tenant-key scoped and old windows for an active key are pruned as it is used.

Tenant IDs are taken only from the authenticated key record, never from request bodies or query parameters. List, rotate and revoke queries always include that tenant ID. Cross-tenant access is treated as not found.

The generic idempotency store is tenant-scoped and binds each idempotency key to a SHA-256 request hash and operation. Reusing a key with a different operation or body is a conflict. API-key create/rotate calls explicitly reject `Idempotency-Key`: returning a previous one-time secret would require storing or replaying the secret, which is prohibited by the hash-only storage policy.

## Migrations

Migrations are sorted files matching `NNNN_name.sql`. Each migration runs in a transaction and takes a PostgreSQL transaction-scoped advisory lock. The runner records a SHA-256 checksum and refuses to continue if an applied migration has been edited. It is safe to run the runner more than once.

Run migrations as a one-off release step before adding/replacing API replicas:

~~~bash
docker compose --env-file .env.api -f compose.api.yaml run --rm migrate
~~~

Do not edit an applied migration. Add a new numbered migration.

## Checks

~~~bash
pnpm --filter @moduqr/api lint
pnpm --filter @moduqr/api typecheck
pnpm --filter @moduqr/api test
pnpm --filter @moduqr/api build
~~~

PostgreSQL integration tests require `psql` and a disposable database:

~~~bash
DATABASE_URL=postgresql://moduqr:local-test-password@127.0.0.1:5432/moduqr_test pnpm --filter @moduqr/api test:integration
~~~

Never point integration tests at production data.
