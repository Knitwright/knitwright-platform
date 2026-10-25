# 0055: Generated-image checker

Status: Proposed (the thresholds are untuned defaults)
Date: 2026-10-25
Plan step: platform v4, wave 3, W3-C (`plans/platform-v4.md`)

## Context

The spec says a failed generation (a warped crest, wrong colours) is rejected automatically by comparing the generated garment with the deterministic render it came from. Lifestyle images and try-on (W3-B) will need this before a picture is shown to a club. This step builds the comparison as pure functions. It calls no model, has no route and no table.

## Decision

`lib/media-check` exports `checkGeneration({ reference, generated, protectedRegions, panels?, thresholds? })`. `reference` is a PNG whose alpha channel is the garment mask; `generated` is a picture on the same canvas. The answer is a report: a verdict `passed` or `rejected`, a list of findings (code, plain message, measured number, threshold, region), the names of the checks that failed (so a retry can be aimed), and every measurement taken, including those that did not fail.

Both pictures are shrunk to 512 px on the long side and softened with a 3 px box blur, then:

1. **Input.** An unreadable generated picture, or one whose shape differs from the reference by more than 0.02 in aspect ratio, is a finding (`unreadable_generated`, `canvas_mismatch`). An unreadable reference, or one with no garment in it, throws: that is our bug, not a bad generation.
2. **Alignment.** The generated garment is found as "not the background", the background being a plane fitted to the pixels well outside the reference mask (so a soft gradient is not mistaken for garment). Intersection over union with the reference mask must reach 0.85, else `not_aligned`, and the other checks are not run (they would measure nonsense, and a false pass is worse than a clear reason). If the garment fills the canvas there is no background to tell it apart from, and the check is reported as skipped.
3. **Colour.** Per panel, the median CIEDE2000 between the two pictures over the garment (eroded 4 px, marks cut out) must stay under 10, else `colour_changed`. `rgbToLab` is reused from `lib/design-import/colours`. The repository had only CIE76 (`deltaE` there and in `lib/print/rules`); CIEDE2000 itself is new (`ciede2000.ts`, tested against the published Sharma, Wu and Dalal pairs).
4. **Structure.** Per panel, the Pearson correlation of the two Sobel edge maps over the same pixels must reach 0.8, else `structure_moved`. Pearson is blind to a brightness scale, so relighting does not count against it. A panel whose reference has no edges is skipped, not passed by arithmetic.
5. **Protected regions** (crest, sponsor, name, number). The reference crop and the generated crop are compared by normalised cross-correlation, searched over a 2 px (analysis scale) window so a hair of drift is tolerated, and must reach 0.8. A generated crop with no detail where the reference has some is `protected_missing`; otherwise a low match is `protected_warped`. A mark that matches in shape is also held to a median CIEDE2000 of 15 (`protected_colour_changed`). A mark outside the canvas is `protected_missing`.

Thresholds are the `Thresholds` settings (`settings.ts`, a Zod schema with ranges) with the label "Knitwright default, not tested against real generations". `resolveThresholds` merges overrides and refuses out-of-range values, so the admin console (W3-F) can store them and pass them in.

No new dependency (sharp and fast-check are already in use). The result is deterministic: the same bytes and settings give the same report.

## What the checker cannot do

- It checks only what the reference defines: colour, seams and stripes, the protected marks, and where the garment sits. It cannot judge realism, hands, faces, fabric folds, a wrong background or a garment of a different cut.
- **The thresholds have not been tuned on real generated images.** Every number above was set against synthetic pictures made in the tests (a clean copy, a hue shift, a warped crest, a moved stripe, a shifted garment, a soft relight). Real generations will need a sample from the owner's providers, and the thresholds will probably move. Until then a pass means "no failure of these four kinds was measured", nothing more.
- Photoreal output adds folds and shading the reference does not have, which lowers the structure score and raises the colour difference. Both limits may need loosening, which makes the checker blind to smaller faults.
- The generated garment is found by contrast with the background. A garment as light as its background, or a busy scene behind it, defeats the alignment step (the report is `not_aligned`, not a false pass).
- A flat reference gives no structure or mark to compare; those checks are reported as skipped.
- Latency: about 0.3 s for a 1024 px pair on a development machine; the test allows 1 s and runs under coverage.

## Owner questions

1. A sample of real generations (good and bad) from the chosen image provider, with the render each came from, so the thresholds can be tuned.
2. Should a rejected picture be retried automatically (the report names the failed checks), and how many times?
3. Is a skipped check (flat panel, garment filling the canvas) acceptable as a pass, or should it send the picture to a person?
