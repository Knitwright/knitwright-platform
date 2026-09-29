# 0009: Flats: one geometry model, two renderers

Status: Accepted. The drawings themselves wait for the owner (action A6).
Date: 2026-09-29
Plan step: 7

## Decision

1. **`lib/flat` turns a design into a geometry model**: named layers holding paths, text
   and pictures, in tenths of a millimetre, with one scale on both axes. Two renderers
   draw the same model: an SVG with named layers, and PDF primitives.
2. **The layers are part of the contract**: Panels, Seams, Stitching, Details, Artwork,
   Measurements. Each view also carries one closed outline of the whole garment and the
   edge of the neck opening, for the 3D preview.
3. **A garment type is a template** that turns measurements into designed shapes. A new
   type is a new template plus registry data.
4. **With measurements missing, the flat is drawn from proportions.** It is marked not to
   scale, it carries no measurement values, and its SVG claims no physical size.
5. **A missing value never becomes zero.** The drawing falls back to proportions or stops
   with an error that names the broken rule.
6. **The drawing is shown in the browser as an image**, so nothing inside it can run.
7. **Each panel colour has an optional colour for the screen** beside its free text code.
   Choosing a screen colour never writes a colour code: a screen colour is not a colour
   reference for a factory.
8. **Artwork must be a file of the same brand.** The server checks it when a design is
   saved, and drops it on opening if the brand can no longer read it.
9. **Pictures in the drawing are limited**: 8 pictures, 3 MB each before download,
   600 KB embedded in a page, 3 reads at a time.
10. **Artwork is not clipped to its panel.** The PDF library cannot clip pictures, so
    neither renderer does.

## Evidence

| Claim | Test |
|---|---|
| Panels are closed, do not cross themselves, mirror left and right, and match the measurements to a tenth of a millimetre | `lib/flat/build.geometry.test.ts`, 1,580 sampled cases |
| What defines each shape, such as collar points and where the placket starts | `lib/flat/build.shapes.test.ts` |
| Both renderers draw every element, in the same order | `lib/flat/render-pdf.test.ts`, `render-pdf.readback.test.ts` |
| Text from a user cannot break out of the SVG | `lib/flat/render-svg.test.ts` |
| A file of another brand cannot be saved into a design | `tests/integration/artwork-files.test.ts` |
| Changing a measurement changes the flat | `lib/flat/build.test.ts`, one case for each point of measure |

## Review, 2026-09-29

A reviewer found nothing critical and four high problems, all fixed: a drawing that was
not to scale still claimed a size in millimetres, a file of another brand could be
saved into a design, loading pictures had no limits, and the collars were not credible.
Twelve deliberate breaks went unnoticed by the tests, mostly in the PDF renderer, which
now has tests that read back what it drew.

## What the tests cannot say

The tests check that shapes are closed, mirrored, to scale, and have the features that
define them. They cannot say that a drawing looks right to someone who makes garments.
After the fix pass the polo collar has leaves, fold lines, a stand and a placket that
starts at the neckline, and it is better than before. It still reads more like a shawl
collar round a wide opening than like a polo collar. The owner's approval of every
drawing in `docs/owner/flats` is the real check, and it has not been given.

## Consequences

- The proportions used when measurements are missing, and every fixed share such as the
  width of a neckband, are listed in `apps/web/lib/flat/OWNER-QUESTIONS.md`.
- Wearer and fit do not change the shape yet.
- The PDF renderer was proven locally. See decision 0008 for what is owed on the first
  deployment.
