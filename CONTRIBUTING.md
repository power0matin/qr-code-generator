# Contributing to ModuQR

Thanks for helping improve ModuQR. Keep contributions focused, testable, and scan-safe.

## Workflow

1. Create a feature branch from `main`.
2. Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
3. Add or update tests for behavior changes.
4. Run `pnpm check` and relevant Playwright tests.
5. Open a pull request explaining the user impact and scanability/security implications.

## QR styling rule

A new renderer style or preset is not accepted until representative payloads can be rendered and decoded again. A visual-only approval is not enough.

## Engineering rules

- Keep TypeScript strict. Do not silence errors with `any`.
- Do not add tracking to static mode.
- Avoid server dependencies for static QR generation.
- Explain non-obvious workarounds in code or an issue.
- Keep public APIs small and documented.
