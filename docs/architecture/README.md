# Architecture

ModuQR separates the QR specification work from the design surface.

```text
apps/web
  React/Next.js UI, local persistence, scanner, export orchestration
packages/core
  payload serialization, smart detection, validation, raw matrix encoding boundary
packages/renderer
  ModuQR-owned SVG rendering from boolean matrices
packages/presets
  data-only preset definitions
packages/scan-validator
  deterministic scan-safety heuristics
packages/shared
  stable cross-package types and document schema version
```

## Encoding vs rendering

`@moduqr/core` calls the small `qr` encoder with raw matrix output and a one-module encoder border. `@moduqr/core` immediately strips that border, because `qr@0.6.0` rejects a zero border; the visible quiet zone remains fully owned by ModuQR. The renderer never asks the encoder for styled SVG. Finder rendering, module shapes, quiet zone, gradients, logo cutouts and frames are owned by `@moduqr/renderer`.

This boundary is intentional: replacing the encoder should not require rewriting the visual system, and adding a visual style should not alter payload generation.

## Client privacy boundary

Phase 1 has no application API for static QR generation. Payloads, logo files, scanner images, and IndexedDB projects stay client-side. The browser may still make normal requests required to load the web application itself.

## Document migrations

Saved designs carry `version: 1`. Future schema changes must add explicit migration code before incrementing the schema. Unknown or malformed JSON is rejected with Zod rather than silently coerced.

## Future packages

`react`, `sdk`, `cli`, and `mcp` are deliberately absent until Phase 3 APIs exist. Empty packages would create false stability commitments.
