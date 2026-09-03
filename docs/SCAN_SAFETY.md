# Scan Safety model

The current score is a deterministic advisory signal. It is not a certification and must not be presented as a guarantee that every physical print will scan.

## Inputs

The evaluator currently considers:

- foreground/background luminance contrast
- weakest module/background gradient-stop contrast across multi-stop gradients
- all resolved finder outer/pupil colors, including inherited foreground colors, against solid or gradient backgrounds
- quiet-zone width in modules
- encoded QR version/density
- module size at the requested output width
- logo footprint, cutout behavior and selected ECC
- geometry known to remove more standard module/finder area
- inability to encode an over-capacity payload
- result of decoding the final browser-rasterized renderer output

An encoding failure returns a controlled `ENCODE_FAILED` issue with a zero score. A failed final rendered decode carries the largest normal scanability penalty.

## Export gate

Preview and export use the same SVG renderer. Before a download, ModuQR rasterizes that SVG and decodes it. PNG/JPEG/WebP are decoded again after compression. If validation fails, export is blocked rather than silently delivering an unreadable QR.

The renderer also keeps Finder patterns solid when module gradients are enabled and places visual frames after the complete QR square so CTA artwork does not intrude into the quiet zone.

## Limits

The Phase 2 foundation understands advanced module/background gradients, neighbour-aware modules and independent finder colors, but it does not yet simulate printer dot gain, perspective distortion, blur, rotation, low-light camera noise, paper reflectivity or real viewing distance. Those multi-condition decode simulations remain a later Safety v2 milestone.
