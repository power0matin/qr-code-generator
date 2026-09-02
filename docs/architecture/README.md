# Architecture

ModuQR separates QR specification work from the design surface.

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
  cross-package types and the current design document schema version
```

## Encoding vs rendering

`@moduqr/core` calls the small `qr` encoder with raw matrix output and a one-module encoder border. `@moduqr/core` immediately strips that border, because `qr@0.6.0` rejects a zero border; the visible quiet zone remains fully owned by ModuQR. The renderer never asks the encoder for styled SVG. Finder rendering, module shapes, quiet zone, gradients, logo cutouts and frames are owned by `@moduqr/renderer`.

This boundary is intentional: replacing the encoder should not require rewriting the visual system, and adding a visual style should not alter payload generation.

## Client privacy boundary

The current static product has no application API for QR generation. Payloads, logo files, scanner images and IndexedDB projects stay client-side. The browser still makes normal requests required to load the web application itself.

## Document migrations

Saved designs currently carry `version: 2`. `packages/core/src/project-schema.ts` can explicitly migrate schema-v1 documents into schema v2. Unknown or malformed JSON is rejected with Zod rather than silently coerced, and imported logo/paint fields are validated as part of that boundary.

Every future schema increment must ship an explicit migration path for supported older documents before the new version becomes the default.

## Local persistence

IndexedDB operations resolve after their transaction completes rather than at individual request success. This makes the in-memory UI state reflect committed browser storage, not an optimistic request callback.

## Future packages

`react`, `sdk`, `cli`, and `mcp` are deliberately absent until their actual public APIs exist. Empty packages would create false stability commitments.
