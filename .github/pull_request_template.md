## What changed

## Why

## Verification
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm typecheck`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm build`
- [ ] `corepack pnpm --filter @moduqr/web test:a11y`
- [ ] Relevant Playwright E2E tests
- [ ] `corepack pnpm audit:prod`

## QR / privacy checklist
- [ ] New rendering styles were decode-tested when applicable.
- [ ] Sensitive payloads are not added to URLs, logs, analytics, or error reports.
- [ ] UI works with keyboard and at mobile widths.
- [ ] README/docs only describe behavior that is implemented.
