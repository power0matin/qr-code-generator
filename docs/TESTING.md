# Testing

The release gate is intentionally layered:

1. ESLint with zero warnings.
2. TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
3. Vitest unit tests for payloads, renderer behavior, safety scoring, and presets.
4. Next.js production build.
5. Playwright across Chromium, Firefox, WebKit, Mobile Chrome and Mobile WebKit.
6. axe-core smoke tests with serious/critical violations treated as failures.
7. Dependency audit at `high` severity and CodeQL.

## QR round trip

The critical browser test captures output produced by the ModuQR renderer, feeds the resulting image to the local decoder, and checks that the payload survives the round trip.

## Responsive matrix

The studio is checked for horizontal overflow at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS pixels.

## Release rule

Do not create the first public tag, `v0.1.0`, until the complete release gate has passed from a clean checkout with a generated lockfile. Later release tags must satisfy the same gate and follow `docs/VERSIONING.md`.
