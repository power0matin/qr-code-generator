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

`@moduqr/core` calls the pinned `qr@0.7.2` encoder with raw matrix output and a one-module encoder border, then immediately strips that border. The visible quiet zone remains fully owned by ModuQR. The renderer never asks the encoder for styled SVG. Finder rendering, module shapes, quiet zone, gradients, logo cutouts and frames are owned by `@moduqr/renderer`.

This boundary is intentional: replacing the encoder should not require rewriting the visual system, and adding a visual style should not alter payload generation.

## Client privacy boundary

The current static product has no application API for QR generation. Payloads, logo files, scanner images and IndexedDB projects stay client-side. The browser still makes normal requests required to load the web application itself.

## Document migrations

Saved designs currently carry `version: 3`, as defined by `DESIGN_SCHEMA_VERSION` in `packages/shared/src/index.ts`. `packages/core/src/project-schema.ts` explicitly migrates schema-v1 and schema-v2 documents into schema v3. The v1 migration adds Phase 2 finder overrides, background-gradient and region-style defaults; the v2 migration adds region styles. Both migrations initialize tags and revision metadata. Unknown or malformed JSON is rejected with Zod rather than silently coerced, and imported logo/paint fields are validated as part of that boundary.

Every future schema increment must ship an explicit migration path for supported older documents before the new version becomes the default.

## Local persistence

IndexedDB operations resolve after their transaction completes rather than at individual request success. This makes the in-memory UI state reflect committed browser storage, not an optimistic request callback.

## Future packages

`react`, `sdk`, `cli`, and `mcp` are deliberately absent until their actual public APIs exist. Empty packages would create false stability commitments.
