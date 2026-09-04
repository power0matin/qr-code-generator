<div align="center">
  <img src="apps/web/public/icons/icon.svg" width="88" height="88" alt="ModuQR logo" />

# ModuQR

**Advanced QR Code Generator, Designer & Scanner**

A privacy-first, SVG-native QR studio with explainable scan-safety checks.

![Status](https://img.shields.io/badge/status-pre--1.0-5b4cf0)
![License](https://img.shields.io/badge/license-MIT-111318)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Privacy](https://img.shields.io/badge/static%20payloads-local-0c7a52)

[Designer](#designer) · [Scan safety](#scan-safety) · [Architecture](docs/architecture/README.md) · [Testing](docs/TESTING.md) · [Versioning](docs/VERSIONING.md) · [Roadmap](ROADMAP.md) · [فارسی](docs/fa/README.md)
</div>

*Release status:* pre-1.0 development. The repository version is currently `0.1.0`; the first public tag will be `v0.1.0` only after the clean-install CI, browser matrix, accessibility, dependency-audit and production-build gates pass.

## Why ModuQR?

Most QR tools couple encoding and decoration. ModuQR keeps them separate: the encoder produces a boolean matrix; ModuQR owns the visual SVG layer. That makes styling testable without turning the project into a wrapper around a QR styling library.

The second rule is privacy. Static payloads, WiFi credentials, logos, scanned images and saved projects are processed in the browser. A ModuQR application server is not required for static QR generation.

## Designer

The current static studio includes the Phase 1 foundation plus the Phase 2 professional-designer implementation candidate:

- URL, text, email, phone, SMS, WhatsApp, WiFi, vCard, geolocation and iCalendar payloads
- Smart input detection plus editable parsing for structured WiFi, vCard, calendar and messaging payloads
- ModuQR-owned SVG rendering over a raw QR matrix
- square, rounded, extra-rounded, dot/circle, diamond, soft-square, pixel, Connected and Fluid module styles
- neighbour-aware Connected/Fluid rendering
- square, rounded and circular finder rendering with independent top-left, top-right and bottom-left overrides
- solid colors, multi-stop linear/radial module gradients, independent background gradients, per-region data/timing/alignment styling, quiet-zone and error-correction controls
- PNG, JPEG, WebP and sanitized SVG logos with protected finder regions and center cutout
- minimal, rounded, badge, label and sticker-style frames kept outside the QR square
- 60 data-defined presets with search, category filters and local favorites; every preset is covered by automated decode regression tests
- live preview, advanced Undo/Redo, Reset, Surprise Me, keyboard shortcuts, project tags, duplicate/search and 40-revision local design history
- versioned JSON design import/export with explicit v1/v2 → v3 project migration plus privacy-safe design-only share URLs
- custom raster export from 256–8192 px plus 512/1024/2048/4096 presets
- SVG, PNG, JPEG, WebP and PDF export through the same renderer
- mockup preview, printer-aware sizing guidance, Scan Safety v2 stress simulations and deterministic scan-first Auto Fix
- local CSV/TSV/JSON batch generation up to 500 rows with templates, Worker preparation, ZIP exports and PDF sheets

### Scan → Redesign

The local scanner accepts live camera input plus uploaded, dropped or pasted raster images. It detects the decoded content type, previews normalized HTTP(S) URLs before navigation, and can send the payload into the Designer using same-tab `sessionStorage` instead of putting sensitive content into the URL.

## Scan safety

Scan Safety v2 is deterministic and explainable. It evaluates contrast, weakest gradient-stop contrast, finder and per-region contrast, quiet zone, QR density/version, output module size, logo pressure, higher-risk geometry, encoding failure and — most importantly — whether the final browser-rasterized SVG can actually be decoded. Optional local degradation tests exercise blur, down/up-scaling, rotation and reduced contrast; Auto Fix applies conservative styling changes and is regression-tested to improve deliberately risky designs.

Every export performs a decode preflight. Raster exports are checked again after image compression before the download is allowed. The score is a risk signal, not a guarantee for every printer, surface, camera or lighting condition.

See [Scan Safety](docs/SCAN_SAFETY.md).

## Local projects

Projects are stored in IndexedDB and carry an explicit document schema version. The Projects view supports search across names/tags/content, sorting, tags, favorites, rename, duplicate, delete and reopen. Saved edits retain the latest 40 local revisions for explicit restore-as-working-copy history. Transactions are treated as complete only after IndexedDB commits them. JSON export is the portable backup format.

## Privacy & security

- no account is required for static generation
- no application analytics or advertising cookies are required by the static application
- static QR payloads are not sent to a ModuQR backend
- logo files are validated by MIME/signature and bounded decoded dimensions; SVG logos pass a strict allowlist sanitizer before embedding
- imported design JSON is schema-validated and rejects unsafe paint values, mismatched logo MIME data and unsafe SVG content
- scanner raster inputs are signature/dimension checked before browser decoding; decoded URLs are normalized and never opened automatically
- URL mode accepts only HTTP(S); arbitrary schemes remain possible as plain text
- production headers include CSP, Referrer-Policy, `nosniff`, frame protection, Permissions-Policy, COOP and CORP; HSTS is enabled when the configured public origin is HTTPS

Read [SECURITY.md](SECURITY.md) and the in-app Privacy page before changing these boundaries.

## PWA & offline behavior

The production web app includes a manifest, install icons, a service worker and an explicit offline state. Static routes/assets already cached while online can be reused offline; QR encoding/rendering itself has no server dependency. Development mode intentionally unregisters old ModuQR service workers so stale Next.js assets cannot interfere with local work.

## Architecture

```text
apps/
  web/               Next.js product UI, IndexedDB, scanner, export orchestration
packages/
  core/              payload schemas, Smart Detect, encoding boundary
  renderer/          custom SVG renderer over boolean QR matrices
  presets/           data-defined design presets
  scan-validator/    deterministic safety analysis
  shared/            cross-package contracts and document schema version
```

Future `react`, `sdk`, `cli` and `mcp` packages are deliberately absent until their public APIs exist.

## Development

Requirements: Node.js 22.14+ and pnpm 10.15.0 through Corepack.

A setup that also works on Windows machines where `corepack enable` cannot write into `Program Files`:

```bash
corepack prepare pnpm@10.15.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Quality gates:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm --filter @moduqr/web test:a11y
corepack pnpm --filter @moduqr/web test:e2e
corepack pnpm audit:prod
```

Local Playwright runs use the system-installed Google Chrome channel, so a Playwright browser download is not required for normal local QA. CI performs the wider Chromium, Firefox, WebKit and mobile-emulation matrix after a production build.

Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin before a production deployment. `NEXT_PUBLIC_REPOSITORY_URL` enables the repository link in the header and defaults to the official GitHub repository in `.env.example`.

## Testing

Vitest covers payloads, v1/v2→v3 project migration/import boundaries, renderer behavior, 60 presets, batch parsing/limits, ZIP generation, design-only sharing, print planning and safety scoring. Playwright covers decode round trips, Phase 2 preset scans, safety simulations/Auto Fix, camera permission handling, batch Worker preparation, export preflight, PWA behavior, accessibility smoke tests, project persistence/history/tags, over-capacity payload handling, RTL/touch behavior and horizontal-overflow checks at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS pixels.

A new visual style is not releaseable merely because it looks good: it must survive automated decode regression coverage.

## SEO

Useful landing pages exist for static features that actually ship. Batch is a shipped Phase 2 static feature and is indexed; the Dynamic route remains roadmap documentation, is `noindex`, and stays out of the sitemap until Phase 3 server mode ships. Metadata includes canonical URLs, sitemap, robots, raster OpenGraph/Twitter artwork and structured SoftwareApplication/FAQ data.

## Roadmap and versioning

Roadmap phases are product milestones, **not SemVer major versions**. ModuQR starts at `0.1.0` and will use incremental pre-1.0 releases while the public APIs, design schema and optional server platform are still evolving. `1.0.0` is reserved for the point where the project is genuinely stable enough to make long-term compatibility commitments.

See [VERSIONING.md](docs/VERSIONING.md) for the release policy and [ROADMAP.md](ROADMAP.md) for product milestones.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Conventional Commits are required and scanability/security implications belong in every renderer or payload PR.

## License

MIT. “QR Code” is a registered trademark of DENSO WAVE INCORPORATED.
