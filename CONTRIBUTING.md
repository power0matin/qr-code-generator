# Contributing to ModuQR

Thanks for helping improve ModuQR. Keep contributions focused, testable and scan-safe.

## Workflow

1. Create a feature branch from `main`.
2. Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
3. Add or update tests for behavior changes.
4. Run the complete relevant quality gate before requesting review.
5. Open a pull request explaining user impact plus scanability/security implications.

A Corepack-safe local gate is:

```bash
corepack pnpm check
corepack pnpm --filter @moduqr/web test:a11y
corepack pnpm --filter @moduqr/web test:e2e
corepack pnpm audit:prod
```

Local E2E uses the system Google Chrome channel. CI is responsible for the managed Chromium/Firefox/WebKit matrix.

## QR styling rule

A new renderer style or preset is not accepted until representative payloads can be rendered and decoded again. A visual-only approval is not enough.

## Engineering rules

- Keep TypeScript strict. Do not silence errors with `any`.
- Do not add tracking to static mode.
- Avoid server dependencies for static QR generation.
- Treat imported JSON, SVG and decoded URLs as untrusted input.
- Explain non-obvious workarounds in code, docs or a linked issue.
- Keep public APIs small and documented.
