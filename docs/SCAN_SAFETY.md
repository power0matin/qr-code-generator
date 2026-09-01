# Scan Safety model

The current score is a deterministic advisory signal. It is not a certification and must not be presented as a guarantee that every physical print will scan.

## Inputs

The evaluator currently considers:

- foreground/background luminance contrast
- weakest module/background gradient-stop contrast across multi-stop gradients
- independently customized finder color contrast
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

The Phase 2 foundation now understands advanced module/background gradients and independent finder colors, but it does not yet simulate printer dot gain, perspective distortion, blur, rotation, low-light camera noise, paper reflectivity, or real viewing distance. Those multi-condition decode simulations are the next Safety v2 milestone.
