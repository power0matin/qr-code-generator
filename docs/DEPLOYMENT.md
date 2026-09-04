# Static web deployment

The current Next.js application has no required ModuQR backend for static QR generation.

```bash
corepack prepare pnpm@10.15.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @moduqr/web start
```

Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin so canonical, sitemap and OpenGraph metadata are correct. Invalid/non-HTTP(S) values fall back to the localhost development origin instead of crashing metadata generation.

Set `NEXT_PUBLIC_REPOSITORY_URL` to the HTTPS `github.com` repository URL if the header should expose the GitHub shortcut.

## HTTPS

Use HTTPS in production. Service workers require a secure context outside localhost, and future camera scanning also requires appropriate secure-context permission handling.

## Service worker

Production mode registers the ModuQR service worker and warms the static Next.js assets already loaded by the current page. Development mode clears old ModuQR registrations/caches once per tab to prevent stale Next.js chunks from masking source changes without repeatedly fighting local PWA tests.

Navigation requests use network-first behavior with a cached Studio fallback. Static asset requests use cache-first behavior and are never answered with an HTML navigation fallback.

## Security headers

The Next.js configuration emits CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy headers. HSTS and `upgrade-insecure-requests` are emitted only when `NEXT_PUBLIC_SITE_URL` resolves to an HTTPS origin, so local production QA over `http://127.0.0.1` is not broken by forced upgrades. Review the CSP whenever a new third-party runtime dependency is introduced.
