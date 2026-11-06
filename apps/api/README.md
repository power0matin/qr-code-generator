# ModuQR API foundation

This app is the optional server-side foundation for Phase 3. It does not create dynamic links or change the static QR Studio. The first increment intentionally exposes only liveness and database-backed readiness.

## Runtime

- Node.js 22.14 or newer
- PostgreSQL 15 or newer
- The PostgreSQL client utility (psql), used for bounded readiness queries and explicit SQL migrations
- A PostgreSQL URL in DATABASE_URL

The service has no runtime npm dependencies. It uses Node's HTTP server and invokes psql without a shell. Database credentials are passed to the client through libpq environment variables, never as command-line arguments.

## Local development

From the repository root:

~~~bash
cp .env.api.example .env.api
# Edit .env.api and replace POSTGRES_PASSWORD with a URL-safe random value.
docker compose --env-file .env.api -f compose.api.yaml up --build -d
curl http://127.0.0.1:4100/health/live
curl http://127.0.0.1:4100/health/ready
~~~

The Compose stack binds the API to loopback only. PostgreSQL is not published to the host. A one-shot migration container completes before the API starts. The named database volume persists across normal restarts.

To stop the stack without deleting its data:

~~~bash
docker compose --env-file .env.api -f compose.api.yaml down
~~~

Removing the volume is destructive and should be done only when the local database can be discarded.

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| DATABASE_URL | Yes | — | PostgreSQL connection URL |
| HOST | No | 0.0.0.0 | HTTP bind address |
| PORT | No | 4100 | HTTP bind port |

Only PostgreSQL URLs are accepted. The first increment supports the sslmode URL parameter. Credentials are decoded once and mapped to PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE for libpq. Unsupported URL parameters are rejected rather than silently ignored.

Do not commit real credentials. The local Compose password is not a production secret-management strategy. Production deployments must use a secret manager or protected runtime environment and TLS.

## Health contract

| Method | Path | Meaning |
| --- | --- | --- |
| GET, HEAD | /health/live | The HTTP process is alive; it does not contact PostgreSQL |
| GET, HEAD | /health/ready | PostgreSQL accepts SELECT 1 using the configured credentials |

Readiness returns 503 when PostgreSQL is unavailable, authentication fails, psql is missing, or the bounded database probe times out. Liveness remains independent so an unavailable database does not cause an orchestrator to restart a healthy process continuously.

Responses use no-store caching, a request ID, and a small JSON body. Logs are newline-delimited JSON with an allowlist of operational fields. Request paths, query strings, headers, bodies, DATABASE_URL, passwords, SQL output and database error text are not logged.

## Migrations

Migrations are sorted files matching NNNN_name.sql. Each migration runs in a transaction and takes a PostgreSQL transaction-scoped advisory lock. The runner records a SHA-256 checksum and refuses to continue when an already-applied migration has been edited. It is safe to run the migration command more than once.

Run migrations as a one-off release step before adding or replacing API replicas:

~~~bash
docker compose --env-file .env.api -f compose.api.yaml run --rm migrate
~~~

The development Compose stack runs the same one-shot migration service automatically before the API starts. Migration SQL is the source of truth; do not edit a migration after it has been applied. Add a new numbered migration instead.

## Checks

~~~bash
pnpm --filter @moduqr/api lint
pnpm --filter @moduqr/api typecheck
pnpm --filter @moduqr/api test
pnpm --filter @moduqr/api build
~~~

PostgreSQL integration tests require psql and an empty disposable database:

~~~bash
DATABASE_URL=postgresql://moduqr:local-test-password@127.0.0.1:5432/moduqr_test pnpm --filter @moduqr/api test:integration
~~~

Never point integration tests at production data.
