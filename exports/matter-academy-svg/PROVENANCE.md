# Matter Academy — provenance and usage

Source: `LOGO MATTER.png`  
Source SHA-256: `FEE724BB072D90F90D1A2537185A6176DB9A3674BD65CE669BA087F99226C56F`  
Canvas: `1920 × 1080`  
Background: transparent  
Exact opaque fills: `#CCFC00` and `#D7DFEF`

## Recommended file

`matter-academy-vector.svg` is the normal production asset. Every symbol and letter is encoded as a path; it contains no `<text>`, font dependency, `<image>`, or raster payload. The original layout, transparent canvas, counters, spacing, and colors are preserved.

The source alpha was reconstructed as a high-resolution contour before path fitting. The resulting SVG contains two compound path elements, 13 exterior components, and six counters. Native-size validation is recorded in `validation-metrics.json`.

## Absolute native-size visual identity

`matter-academy-pixel-exact.svg` embeds the supplied PNG losslessly inside an SVG container. Use it only when reproducing every source pixel and its antialiasing at `1920 × 1080` matters more than having scalable vector curves. A Chrome native-size round trip matched all `2,073,600` RGBA pixels.

## Notes

- No black background was added; the black seen in previews is the viewer background.
- The vector export intentionally uses paths instead of guessed fonts, preventing letter substitution or reflow.
- SVG antialiasing can vary slightly between renderers; this is why the separate pixel-exact wrapper is included.
