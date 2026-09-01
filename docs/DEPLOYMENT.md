# Static web deployment

Phase 1 is a Next.js web application with no required ModuQR backend for QR generation. Build it with:

```bash
pnpm install
pnpm build
pnpm --filter @moduqr/web start
```

Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin so canonical, sitemap and OpenGraph metadata are correct.

## HTTPS

Use HTTPS in production. Service workers require a secure context outside localhost, and future camera scanning also requires HTTPS on mobile Safari.

## Security headers

The Next.js configuration emits CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy and Cross-Origin-Opener-Policy headers. Review the CSP whenever a new third-party runtime dependency is introduced.
