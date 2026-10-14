# 0031: Print files for any design

Status: Proposed (phase A and phase B built)
Date: 2026-10-15
Plan step: production outputs, W3 (`plans/production-outputs.md`)

## Context

The benchmark delivers no print files. A sublimation house needs, for every piece in every size, artwork at full size with bleed, scaled for shrink, with marks kept in their places, and one set per player. The owner's correction of 2026-10-14 is that this must work for any design, not only the polka-dot jersey. W7a gave one design-agnostic stack (decision 0035) and left a `PieceMapper` interface for this workstream.

## Decision

1. **The renderer knows only the stack.** Layout (`lib/print/layout`) turns a stack into a scene of filled shapes, strokes and pictures (`lib/print/scene.ts`), one layer kind at a time in blend order. SVG, PDF and TIFF draw that scene (`lib/print/render`). A new style, upload kind or reader of pictures never touches a renderer.
2. **The piece is the master** (decision 0034). `createPieceMapper` is the real `PieceMapper`. A piece lies on the design plane by a turn and a move only, fixed by landmarks: the centre line and the chest line (the underarm). The pattern file is read as drawn from the outside. A right sleeve is the mirror image of the sleeve in the file; the file's sleeve is read as the left. Nothing is stretched, so a repeat is the same size in every size, and rows that hang from the chest line meet at the side seam and the underarm.
3. **Pieces cut on the fold are opened** about the fold line; artwork is not mirrored. A point on the mirrored half maps to the other side of the centre line.
4. **One field for the whole garment.** The seven older styles grow their rows from the edge of the box they are given and ignore the datum. So every piece of a size is drawn over one box: the garment's extent, centred on the centre line, starting 400 mm above the chest line. Generators that honour the datum (W7c) get the same box and agree for free.
5. **Zones** are boxes in design space relative to the centre line and chest line (`zones/templates.ts`), turned into the contract's `PrintZone` polygons per size. They are Knitwright defaults for a football jersey, not a competition's rules. Junior sizes carry marks 20 % smaller (a setting). A graphic names a zone or a free anchor; a free anchor is reported as outside the standard places.
6. **Clear space knocks out the pattern and picture layers beneath a mark, never the ground.** A player's name or number clears its whole place whoever the player is, so every player's file has the same pattern.
7. **Marks are never squeezed.** A name steps down from its height to the smallest allowed (the print house's, else 35 mm labelled as Knitwright's default). If it still does not fit its place it is left off and the file says so with a "do not print" line.
8. **Text is outlined** from the bundled Geist font by a small TrueType reader (`lib/print/text`), so no font travels and no dependency is added.
9. **Pictures** are read from the full-resolution print copy through the asset reader and resampled once to the print resolution, never up. The effective dpi is reported per piece, with the largest size at which the file would still meet the minimum.
10. **Blend.** Normal and knock-out stay vector. A piece with multiply, screen or overlay is written as one picture and its margin says so.
11. **Shrink** scales art and the cut line together, along and across the grain, by `printScale` of the fabric. With no tested shrink the scale is 1 and the margin says "Not scaled for shrink".
12. **PDF is written by hand** (`render/pdf`). The spike of `@react-pdf/renderer` found it writes a creation date and a file id that change on every run, and it warns about a page-sized drawing, so it cannot give byte-identical files at exact page sizes. `pdfkit` is not a dependency and adding it only to set two dates was not worth it. The hand writer is about 250 lines, has exact page sizes, an optional layer for the guides, and no clock. TIFF goes through `sharp`; SVG is built on download and never stored. A zip is built on download with no clock.
13. **Roster.** A roster row becomes a file set: the pieces that carry the player's name or number, plus the marks alone for transfers. Duplicate numbers and sizes outside the run are the roster workstream's (W4) to flag.

## Phase B: the real inputs

Phase A was built against fakes. Phase B swaps each one for the real service, and the acceptance cases run through them (`lib/print/acceptance`).

14. **Pictures and logos come from W7b.** `createAssetReader` (brand-scoped) is the only way a print file sees a user's artwork. A raster is read from its full size print copy, never the screen copy (a test spies on both reads). A vector is read from W7b's restricted vector model (`lib/print/layout/vector-art.ts` reads it directly: transforms applied, curves flattened to 16 or 12 straight runs). What a print cannot keep is said in the file's margin, never dropped quietly: a gradient prints as one flat colour from its middle, a picture inside a logo, a clip and a see-through part are left or simplified and named. A logo added through the older logo path has only a screen copy, so it is left off with a sentence that says to upload it again.
15. **Patterns come from W1.** `loadDesignPattern` builds the graded pattern from the brand's library: the block named, at the version a release froze, else the newest block for the garment. A block id names one version, so a release cannot print from a pattern that has changed. The margin of every file names the pattern and version, and who reviewed it, or says "Draft pattern, not reviewed." The benchmark jersey is no longer used outside tests.
16. **Generators come from W7c.** The registry (`GENERATORS`) replaces the seven older styles. The older styles keep their own front and back drawing. For a newer style (camo, checks, brush...) the **back is read turned about the centre line and shifted so the two underarm landmarks meet** (`layout/seam.ts`): on the design plane the underarm is on the left of the front and the right of the back, and it is one seam. This makes a field continuous across the side seam exactly when the front and the back are the same width at the underarm; when they differ it is exact at the underarm seam and out by twice the difference at the other. Making both seams exact needs a warp that follows each seam's length, which is not done. Picture repeats are not turned: a picture must read the right way round.
17. **Bounds that reach a generator are sound.** NaN, infinite, zero or upside-down bounds leave the pattern off with a sentence; the shared field box is always finite.
18. **Team orders come from W4.** A roster is the order's rows. The download takes `order` (a team list of the design); a row whose size is not in the pattern is named in the read-me and left out. Without `order` no player files are made.
19. **Releases freeze real files** (`lib/print/inputs/release.ts`, wired in `lib/releases/builder.ts`). The builder is the same one the download uses, loaded lazily on the first file. It reads the design as it is now, the named pattern at its frozen version, and the brand's print settings, colour profile and artwork, and the release's team list. A release made with a pattern that is not in the library is refused with a sentence. Print and release routes are open to whoever the pattern library is open to (`requireLibraryOpen`).
20. **Colour profile.** The brand's ICC profile is read with the person's own client and embedded in TIFF files. A profile that cannot be read or is over 8 MB is left out, and the files carry no profile.
21. **A layer at no opacity prints nothing** and its artwork is never read (a knock-out still cuts). The picture reader keeps its alternatives that way.
22. **A design read from a picture** carries "Read from a picture. Compare with the picture before printing." in every file of the design, not only the pieces that hold a layer from it.

## Measured in phase B

- Case 2, a 6000 x 8000 px test card through W7b's intake: every fiducial lands within 1 mm of the place worked out from the design plane in all seven sizes, front and back, and the black squares found in the 150 dpi pixels of the file are within 1 mm of the same places. In the band 2 to 13 mm outside the cut line, the file shows the card's own checker, cell for cell.
- Case 3, an SVG logo through intake: 90 mm wide within 0.1 mm in every size, no picture in the PDF (path operators only), no SVG stored anywhere.
- Case 4, camo seed 7: identical bytes twice (PDF and SVG), other bytes for seed 8, and the field agrees at every sampled point across the side seam in every size.
- Case 5, with W7d phase B (merged): a tee with white polka dots (16 mm dots, 36 mm pitch) is drawn, read by the real pipeline and pattern step from a recorded reply, and printed. W7d reads the dots style (16.2, 38.7, 18.1 mm), the print's average colour is within 2.3 (CIE76) of the true print on the front and the back, and every file of every size carries the picture note. Pixel by pixel the two differ by about 30, because the read repeat is 7 % off and the dots drift apart; that measures the drift, so no limit is set on it. The reader's alternative (the picture as a repeat, at no opacity) is not built and its picture is not read.

## Limits and open items

- Shrink is not applied: the scale is 1 and every margin says "Not scaled for shrink" until fabric tests are read (the contract's `printScale`).
- The download and the release use no league rule set unless the download names one (`rules`); a release carries no rule set, so releases check against none and say so.
- `PrintRuleSet.numberRules.allowedDigits` is a string of one to three digits in the contract; it is read here as the highest number the competition allows (for example "99"). To be confirmed with the contract's owner.
- The panel box for a full-panel picture is the piece grown by the bleed when the fit is "cover", so the art itself continues into the bleed; "contain" fits inside the piece.
- A piece with no landmarks (the collar in the sample) is laid out by its fold line, and the pattern across the collar is not matched to the body.
- Across an armhole the rows can agree only at the underarm and the shoulder point, because the sleeve cap is curved; the margin does not yet say so per piece.
- Names are outlined with Geist, not the club's lettering (owner question P8).
- No screen yet places a stored artwork on a design (the artwork panel only uploads), so the end-to-end test writes the stack the way the editor will.
- The route is one request of at most 60 seconds and at most 600 files; a large team list with several formats may need to be split by size.

## Alternatives

- Stretch the design to each size by landmark fit: keeps marks proportional but changes the repeat size, which the benchmark forbids.
- Let each generator draw per piece: rows would not meet at seams.
- Add `pdfkit` or keep `@react-pdf` and patch the dates after the fact: more moving parts than a small writer.

## Consequences

Easier: any stack prints; the same code draws a kit style, an upload and a picture. Harder: the older styles still need the shared box to meet at seams; W7c's generators remove the need. Revisit when fabric tests give a shrink scale, and when the 3D trial (W6) decides whether the mapper falls back to the flat's outline.
