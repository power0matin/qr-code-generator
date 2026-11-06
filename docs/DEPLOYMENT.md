# Static web deployment

The current Next.js application has no required ModuQR backend for static QR generation.

~~~bash
corepack prepare pnpm@10.15.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @moduqr/web start
~~~

Set NEXT_PUBLIC_SITE_URL to the public HTTPS origin **before running pnpm build** so canonical, sitemap, OpenGraph metadata and HTTPS-only security headers use the real production origin. This is a Next.js public build-time variable: rebuild the app whenever the public origin changes. Invalid/non-HTTP(S) values fall back to the localhost development origin instead of crashing metadata generation.

Set NEXT_PUBLIC_REPOSITORY_URL to the HTTPS github.com repository URL if the header should expose the GitHub shortcut.

## Runtime requirements

Use Node.js 22.14 or newer and pnpm 10.15.0. Run the production server with corepack pnpm --filter @moduqr/web start after a successful workspace build. Place the app behind an HTTPS reverse proxy in production and forward the original host/protocol correctly.

## HTTPS

Use HTTPS in production. Service workers require a secure context outside localhost, and future camera scanning also requires appropriate secure-context permission handling.

## Service worker

Production mode registers the ModuQR service worker and warms the static Next.js assets already loaded by the current page. Development mode clears old ModuQR registrations/caches once per tab to prevent stale Next.js chunks from masking source changes without repeatedly fighting local PWA tests.

Navigation requests use network-first behavior with a cached Studio fallback. Static asset requests use cache-first behavior and are never answered with an HTML navigation fallback.

## Security headers

The Next.js configuration emits CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy headers. HSTS and upgrade-insecure-requests are emitted only when NEXT_PUBLIC_SITE_URL resolves to an HTTPS origin, so local production QA over http://127.0.0.1 is not broken by forced upgrades. Review the CSP whenever a new third-party runtime dependency is introduced.

## Optional API foundation (Phase 3A and 3B)

The API is a separate, optional service. Static QR generation, the scanner, local projects, PWA behavior and the existing web deployment do not require this stack. Do not add DATABASE_URL to the static web deployment.

For local API development, copy .env.api.example to .env.api, replace the placeholder with a random URL-safe password, then run:

~~~bash
docker compose --env-file .env.api -f compose.api.yaml up --build -d
curl http://127.0.0.1:4100/health/live
curl http://127.0.0.1:4100/health/ready
~~~

The API is bound to 127.0.0.1 by default; PostgreSQL is not published on a host port. The Compose stack runs PostgreSQL, a one-shot migration container and the API. The named PostgreSQL volume persists across restarts. To stop without deleting data, use docker compose --env-file .env.api -f compose.api.yaml down.

The API includes process health, one-time tenant bootstrap and scoped API-key management (create, list, rotate and revoke). API keys are stored as SHA-256 digests only, are tenant-bound and receive a default 90-day expiry. Authenticated API-key management is rate-limited to 60 requests per key per minute. See apps/api/README.md for the route contract and bootstrap procedure.

Dynamic link CRUD, public redirects, analytics, management UI and developer SDKs are not shipped yet. Keep the API private/loopback-bound in this stage; do not expose it as a public dynamic-link service. Public deployment still requires Phase 3C/3D product gates, TLS termination, managed secrets, backup/restore, monitoring and an operational security review.

Migration commands are explicit and idempotent. In a release pipeline, run the one-off migration task successfully before replacing or scaling API replicas:

~~~bash
docker compose --env-file .env.api -f compose.api.yaml run --rm migrate
~~~

See apps/api/README.md for API configuration, health semantics, migration behavior and test requirements.
