# 0031: Print files for any design

Status: Proposed (phase A built; phase B waits for the artwork intake, generators and the picture reader)
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

## Phase A and what is faked

Built and tested against fakes: the asset reader (`fixtures/assets.ts`), generators (a seeded field defined on the whole plane), and the pattern (the benchmark jersey at five test sizes made by stretching EU 48; see `fixtures/graded.ts`). The real polka-dot case (W0b's `kit-dots`) runs through the real generator. Phase B (acceptance cases 2 to 5 against W7b, W7c and W7d) swaps the fakes for the real services. One thing to adapt then: `layout/vector-art.ts` defines the vector print copy this workstream reads (straight-edged shapes, curves already flattened); W7b's restricted vector model needs a small adapter to it.

## Limits and open items

- The download route uses the benchmark jersey pattern for team jerseys and refuses other garments, until the pattern library (W1) can supply the design's own. The margin says so.
- The route has no roster (W4) and no artwork reader (W7b) yet, so it makes the files without names and leaves uploaded pictures off, saying so. The library handles both.
- `PrintRuleSet.numberRules.allowedDigits` is a string of one to three digits in the contract; it is read here as the highest number the competition allows (for example "99"). To be confirmed with the contract's owner.
- The panel box for a full-panel picture is the piece grown by the bleed when the fit is "cover", so the art itself continues into the bleed; "contain" fits inside the piece. Phase B may refine this with real pictures.
- A piece with no landmarks (the collar in the sample) is laid out by its fold line, and the pattern across the collar is not matched to the body.
- Across an armhole the rows can agree only at the underarm and the shoulder point, because the sleeve cap is curved; the margin does not yet say so per piece.
- Names are outlined with Geist, not the club's lettering (owner question P8).
- Print profile and league rule sets are stored per brand (migration `20261015030000`); the route reads the profile and the ICC file, and does not yet let a person pick a rule set.

## Alternatives

- Stretch the design to each size by landmark fit: keeps marks proportional but changes the repeat size, which the benchmark forbids.
- Let each generator draw per piece: rows would not meet at seams.
- Add `pdfkit` or keep `@react-pdf` and patch the dates after the fact: more moving parts than a small writer.

## Consequences

Easier: any stack prints; the same code draws a kit style, an upload and a picture. Harder: the older styles still need the shared box to meet at seams; W7c's generators remove the need. Revisit when W1 lands (real graded patterns) and when the 3D trial (W6) decides whether the mapper falls back to the flat's outline.
