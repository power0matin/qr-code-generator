# Security Policy

## Supported versions

Until the first stable release, security fixes target the `main` branch. Stable releases will follow semantic versioning and receive clearly documented support windows.

## Reporting

Please do not publish exploitable security issues in a public GitHub issue. Use GitHub Private Vulnerability Reporting when enabled for the repository. Include reproduction steps, affected surfaces, and impact.

## Security boundaries

Static QR generation is designed to stay in the browser. Logos and payloads are not sent to a ModuQR server in static mode. SVG uploads are sanitized before rendering. Scanned URLs are previewed before navigation.
