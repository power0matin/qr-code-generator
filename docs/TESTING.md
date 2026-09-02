# Testing

The release gate is intentionally layered:

1. clean dependency install from the committed lockfile (`pnpm install --frozen-lockfile` in CI)
2. ESLint with zero warnings
3. TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
4. Vitest unit/regression tests for payloads, project imports/migrations, renderer behavior, safety scoring and presets
5. Next.js production build
6. Playwright browser/E2E matrix
7. axe-core smoke tests with serious/critical violations treated as failures
8. production dependency audit at `high` severity and CodeQL

## Local browser tests

Local Playwright intentionally uses the installed Google Chrome channel. This avoids making local QA depend on Playwright CDN availability.

```bash
corepack pnpm --filter @moduqr/web test:a11y
corepack pnpm --filter @moduqr/web test:e2e
```

Do not run `playwright install` merely for the local Chrome project. CI installs its own managed browser binaries.

### Local production-build browser test

To exercise the already-built production app with the same system Chrome channel (without downloading Playwright browser binaries), stop any running development server first, build the app, then run:

PowerShell:

```powershell
corepack pnpm build
$env:PLAYWRIGHT_USE_PRODUCTION_BUILD='1'
corepack pnpm --filter @moduqr/web test:e2e
Remove-Item Env:PLAYWRIGHT_USE_PRODUCTION_BUILD
```

POSIX shells:

```bash
corepack pnpm build
PLAYWRIGHT_USE_PRODUCTION_BUILD=1 corepack pnpm --filter @moduqr/web test:e2e
```

When `PLAYWRIGHT_USE_PRODUCTION_BUILD=1`, Playwright starts `next start` itself and deliberately refuses to reuse an existing server. This prevents a development server on port 3000 from being mistaken for a production acceptance run.

## CI browser matrix

After the production app builds, CI exercises Chromium, Firefox, WebKit, desktop/mobile viewport profiles and the same E2E suite. The service-worker test registers `/sw.js` explicitly during local development because the application intentionally does not auto-register production caching in `next dev`. Development cleanup runs once per tab, so the test can reload under the manually registered worker without immediately unregistering it again.

## QR round trip

The critical browser tests capture output produced by the ModuQR renderer, feed the resulting image to the local decoder, and check that the exact payload survives the round trip. Regression tests also cover logos, gradients, neighbour-aware modules, independent finder overrides and all shipped presets.

Over-capacity payloads are expected to fail *safely*: the studio remains mounted, reports an encoding failure and disables export instead of crashing React.

## Persistence and import regressions

Tests cover schema v1 → v2 migration, unsafe imported design rejection and the project favorite/load/save path. IndexedDB writes resolve only after the transaction has completed.

## Responsive matrix

The studio is checked for horizontal overflow at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS pixels.

## Release rule

Do not create the first public tag, `v0.1.0`, until the complete release gate has passed from a clean checkout using the committed lockfile. Later release tags must satisfy the same gate and follow `docs/VERSIONING.md`.
