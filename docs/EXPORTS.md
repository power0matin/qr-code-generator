# Export pipeline

ModuQR has one visual source of truth: the SVG renderer. Preview, vector output and raster/PDF output derive from the same SVG document.

## Formats

- SVG: vector output, optional transparent background
- PNG: lossless raster, optional transparent background
- JPEG: opaque raster
- WebP: compressed raster, optional transparent background
- PDF: the verified QR artwork placed on a PDF page matching the rendered aspect ratio

Raster width can be set from 256 to 8192 pixels. The UI also exposes 512, 1024, 2048 and 4096 pixel shortcuts and displays the approximate physical width at 300 DPI.

## Verification

Export is blocked if the rendered result cannot be decoded back to the exact original payload. Compression-capable raster formats are decoded again from their final Blob before download.
