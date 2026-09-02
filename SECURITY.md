# Security Policy

## Supported versions

Until the first stable release, security fixes target the `main` branch. Stable releases will follow semantic versioning and receive clearly documented support windows.

## Reporting

Please do not publish exploitable security issues in a public GitHub issue. Use GitHub Private Vulnerability Reporting when enabled for the repository. Include reproduction steps, affected surfaces and impact.

## Security boundaries

Static QR generation is designed to stay in the browser. Logos and payloads are not sent to a ModuQR server in static mode. Scanner images are decoded locally.

Logo ingestion is treated as untrusted input:

- PNG/JPEG/WebP uploads are checked against their expected file signatures.
- SVG uploads use an allowlist sanitizer and reject executable/embedding elements, event handlers, external references and non-local paint references.
- Versioned design JSON is schema-validated before loading and rejects unsafe CSS-like color values, mismatched logo MIME/data URLs and unsafe SVG logo content.
- The renderer repeats critical paint/logo checks at runtime so callers cannot bypass import validation by directly invoking package APIs from JavaScript.

Scanned HTTP(S) URLs are normalized, credentials are stripped from preview/open targets, and URLs are never opened automatically. Non-HTTP(S) decoded content remains text unless the user explicitly chooses another action.

Production responses use a restrictive CSP plus Referrer-Policy, `nosniff`, frame protection, Permissions-Policy, COOP and CORP. HSTS and `upgrade-insecure-requests` are enabled only when `NEXT_PUBLIC_SITE_URL` is configured as an HTTPS origin. Development mode is intentionally less strict only where React debugging requires it.
