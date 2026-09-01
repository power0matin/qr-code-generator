# Scan Safety model

The Phase 1 score is a deterministic advisory signal. It is not a certification and must not be presented as a guarantee that every physical print will scan.

## Inputs

The evaluator currently considers:

- foreground/background luminance contrast
- weakest gradient-stop contrast
- quiet-zone width in modules
- encoded QR version/density
- module size at the requested output width
- logo footprint and selected ECC
- geometry known to remove more standard module/finder area
- result of decoding the final browser-rasterized renderer output

A failed final decode has the largest single penalty.

## Export gate

Preview and export use the same SVG renderer. Before a download, ModuQR rasterizes that SVG and decodes it. PNG/JPEG/WebP are decoded again after compression. If validation fails, export is blocked rather than silently delivering an unreadable QR.

## Limits

Phase 1 does not yet simulate printer dot gain, perspective distortion, blur, rotation, low-light camera noise, paper reflectivity or real viewing distance. Those multi-condition checks belong to Safety v2 in Phase 2.
