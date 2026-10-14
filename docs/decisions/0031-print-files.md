# 0031: Print files per piece, size and player, for any design

Status: Accepted for phase A. Phase B (the real artwork intake, generators and picture reader) and the owner inputs below are owed.
Date: 2026-10-14
Plan step: `plans/production-outputs.md`, workstream W3 (and the shared model of W7)

## Context

The fashionINSTA benchmark delivers no print files at all: a DXF and a tech pack that tells the print house to match rows at the
seams and add 1.5 cm of bleed, in prose. A sublimation house prints from one file per pattern piece at 1:1, with bleed, a shrink
scale, a colour profile and clear space round marks, and one set per player. The owner's correction of 2026-10-14 is that this
must hold for any design: every kit style, a club's own artwork, a generated style, a design read from a picture. W7a gave every
design one artwork stack; W3 turns a stack into files and must never ask what made it.

## Decision

1. **One pipeline, six layer kinds.** `lib/print/layout/piece-scene.ts` builds a scene (cut line, bleed line, vector layers, picture
   layers, notes, issues) for one piece, one size and one player from an `ArtworkStack`, one layer kind at a time in the stack's
   order: ground, pattern, picture fill, placed graphic, text, player mark. The three renderers (`lib/print/render/`) read only the
   scene. Nothing in the renderers or the scene builders names a style, a generator or an upload.
2. **The piece is the master (decision 0034).** `lib/print/layout/mapper.ts` implements W7a's `PieceMapper`. Design space is the
   "worn sheet": the body unrolled round the chest with the back beside the front, sleeves at the shoulder points, laid out for each
   size from that size's own landmarks. The scale is 1 in every size, so a repeat does not grade. A piece cut on the fold is opened
   by mirroring its **outline** about the fold line; the artwork is read from the plane across the centre line, so a number stays
   whole. A mirrored pair (the sleeves) is the cut piece for the right and its mirror about the long axis for the left.
3. **One shared datum.** Every repeat is anchored to one datum in design space (the chest line at the centre front and back, moved
   by the stack's offset), not to a piece, so rows meet at the side seam. Measured on the benchmark pieces in every size of the test
   grading: rows on the front and back share one phase within 0.5 mm, a dot column sits on the centre front and back, and the
   camo field agrees across the side seam in 99.2 % of samples taken within 0.25 mm of the join (76.4 % when one side is deliberately slipped 7.3 mm, so the test can tell). Where rows cannot agree
   (the shoulder seam, because the front and back slope differently; a sleeve cap, because it is curved) every file says where they
   agree and by how many millimetres they differ, computed from the pieces. The seven older kit styles ignore the datum, so a
   small shim draws them on a plane whose origin is the datum and moves them back; hoops and dots get a box whose top is a fixed
   distance above it, so their rows keep one phase in every size.
4. **Shrink scale** is applied to the cut line and the art together, along the piece's length (the way the fabric runs) and across
   it, about the centre line at the chest line. A 2.0 / 1.5 % fabric test gives 1.0204 by 1.0152 on all five acceptance designs.
   Without a tested shrink the scale is 1 and the file says "Not scaled for shrink: this fabric has no shrink test."
5. **Clear space** is cut out of the layers beneath a mark, not out of the ground. A motif (a shape no larger than 80 mm, such as a
   polka dot) that touches the clear space is left out whole, as the older dots drawing does; a larger shape is cut to it. The 80 mm
   is a setting. Text and player marks always keep the zone's clear space (10 mm); a placed graphic keeps its own when it is set to
   knock out.
6. **Text is outlined** from the bundled Geist font by a small TrueType reader (`lib/print/text/font.ts`: character map, simple and
   composite glyphs, advance widths; no kerning), so no font travels in a file. The lettering style is written in words (open item
   P8). A name wider than its place is **reported, not squeezed**, and is still drawn at the stated height.
7. **Blend.** Normal and knock-out stay vector. Multiply, screen and overlay turn the whole piece into strips of pixels mixed in the
   stack's order with `sharp`; that piece says so in its margin, and the other pieces stay vector.
8. **PDF.** `@react-pdf/renderer` 4.9 with a custom page size was spiked first (decision 0008's check): a page of 1039.6 x 549.7 mm
   came back from `pdfjs-dist` within 0.00003 mm, so `pdfkit` is not needed. Page one is the piece plus the bleed on every side at
   1:1; page two lists every note in full, because a narrow piece has no room in its margin for them. Vector layers are path
   operators with no image object (read back). **Determinism:** the library finishes compressed streams as they complete, so two
   builds of one file could number and order objects differently (an image's mask was object 29 one time and 30 the next; 3 of 6 runs of one test). `render/pdf-canonical.ts` rewrites the objects in the order they are first reached from the root, numbered in that
   order, with a fresh cross-reference table, and a fixed creation date is set. A PDF it cannot read is returned untouched.
9. **TIFF** through `sharp`, written from raw strips piped into the encoder (4000 x 3000 px in 219 ms; resident memory about 280 MB
   in the spike), at the profile's dpi (150 by default, labelled "Knitwright default, not from your print house"), LZW, density
   tagged, the brand's ICC profile attached when it has one. No strip holds more than 6 million pixels. Over 120 million pixels the
   resolution drops and the file says so. A strip built alone and the page built in one go differ by anti-aliasing only (about 1.3 % of
   the samples of a small piece differ by more than a shade; the test allows 3 %).
10. **SVG is built on download and never stored.** The zip route builds it in memory and sends it inside a zip with a sandboxing
    policy; `tests/integration/isolation.test.ts` is untouched and still forbids `image/svg+xml` in the exports bucket. An SVG holds
    shapes and pictures only (the tests refuse `script`, event attributes and external references in it).
11. **Picture fills and logos** are resampled once to the file's resolution from the full-resolution print copy, never the screen
    copy, and placed as pixels; effective dpi is the source pixels over the printed width, and a picture below the profile's lowest
    resolution gets the sentence "... would print at about 96 dpi at this size. Your print house asks for 150 or more, so it may
    look soft ..." in the margin and the result, with the widest size at which it still meets the minimum. A full-panel picture is
    fitted to the piece's bounds **plus its bleed**, so the art continues into the bleed instead of being smeared; fiducials of a
    6000 x 8000 px test card land within 1 mm in every size tested.
12. **Zones** are defined against landmarks (shares of the shoulder-to-chest depth and the half chest) so they follow every size;
    their sizes are settings labelled "Knitwright default zone, not from your league or print house" except the sponsor's 30 x 7 cm,
    which the plan states. A free anchor is allowed and is reported as "outside the standard zones".
13. **Rules** (`lib/print/rules/`) ship empty and say so ("No league rules set: check with the competition."). A rule has a source.
14. **Players.** `planPlayers` makes one job per roster row with the pattern size its label is cut from (W2's size map), reports a
    label with no size instead of guessing, and adds a transfer-only set (name and number, no ground) when the marks are made by
    transfer.
15. **Files and zip.** A zip (`lib/print/zip.ts`, stored, fixed date, fixed order) holds `pieces/`, `players/NN-number-name/` (and
    `transfer/`), `manifest.csv`, `manifest.json` (a SHA-256 per file) and a plain `README.txt` with the settings used. One request
    makes at most 400 files. Every file says "Draft pattern, not reviewed." until a technician has reviewed the pattern (open item P1).
16. **For releases (W4).** `lib/print/builder.ts` exports `createPrintFileBuilder(deps): PrintFileBuilder` (the W0 interface). The
    spec names a view or a one-view piece id (`front`, `back`, `sleeve-left`, `sleeve-right`, `collar`); `scaleX` is across the piece
    and `scaleY` along its length; the spec's bleed, dpi and scale replace the live settings so a reorder rebuilds the bytes its
    hashes name. `lib/print/server/release-builder.ts` exports `releasePrintBuilder(input)`, which has W4's `BuilderFor` shape
    (`(context: { projectId, roster }) => PrintFileBuilder`) and reads the design lazily on the first file.
17. **Data.** Migration `20261015030000_print_profiles_and_rules.sql`: `print_profiles` (one row per brand: bleed, dpi, lowest dpi,
    widest print, ICC file) and `league_rule_sets` (each with a required source). Members read their own brand's rows; only the
    server writes. Both are in the isolation suite.

## Evidence

- Spikes (throwaway tests, 2026-10-14): react-pdf custom page size, TIFF strips through `sharp`. Recorded above.
- Acceptance, `lib/print/acceptance.*.test.ts`. **Real:** case 1 (the benchmark polka-dot jersey on W0b's dots and W7a's adapters:
  PDF page within 0.1 mm of the piece plus 2 x 15 mm for every piece of all seven sizes, SVG, 150 dpi TIFF of the right pixel size,
  rows, columns and clear space), 6 (shrink, on all five designs), 7 (the 22-player roster), 8 (blend), 9 (determinism, all five
  designs, PDF, SVG and TIFF). **Behind fakes:** cases 2 to 5 use a stand-in asset reader (a 6000 x 8000 px test card, a vector
  logo, a Display P3 colour profile), a stand-in camo generator (seed 7) and a stand-in design reader (a design with every part
  marked "read from a picture" and colours a few levels off); phase B re-runs them on the real implementations.
- The pattern is the benchmark EU 48 jersey. Other sizes in the tests come from a **test grading** (the jersey scaled about the
  origin by a stated factor per size, `lib/print/fixtures/graded.ts`); it is not a grading rule and no number from it is shown as a
  measurement.
- A bug the tests found: matrix coefficients written to two decimals turned a scale of 0.1693 into 0.17 and moved a mark by
  1.7 mm; coefficients are now written to nine decimals (`coefficient` in `render/svg-util.ts`).

## Alternatives

- `pdfkit` directly: not needed; the spike passed. It stays the fallback.
- Rasterising everything: loses vector logos and makes files huge. Only a piece that uses a pixel blend is rasterised.
- A font library for outlines: a new dependency for a few hundred lines; the bundled font has plain simple glyphs.
- A zip library: `fflate` is a dev dependency used in tests; a stored zip needs only CRC-32 and headers, and no new dependency.
- Anchoring repeats to each piece: rows would not meet at seams. Rejected by the benchmark rule.

## Consequences

Easier: a new style, upload kind or generator needs no change here. Harder: the worn sheet is a model, so rows agree with the
neighbouring piece only at the named places and the files say how far they differ elsewhere. Revisit if W6's trial finds the flat
and the piece disagree by more than 3 %, or when the pattern library (W1) supplies real graded sets (the pattern source in
`lib/print/server/pattern-source.ts` is the one function that changes).

### Since this branch was cut

W1 (pattern library), W4 (orders and releases), W7b (artwork intake) and W7c (generator library) have merged. The download route now draws with W7c's
generator library and reads uploaded artwork through W7b's asset reader (a raster's print copy is an sRGB TIFF; `sharp` reads it as it
reads a PNG); `lib/print/layout/vector-asset.ts` reads W7b's restricted vector model (groups, transforms, curves, solid fills, even-odd
and non-zero fill rules, opacity). Case 4 was also run on the real camo: the field is continuous across the side seam in 99.2 % of
samples and two runs give the same bytes (`acceptance.case3to5.test.ts`, last block).

### Phase B needs

- W7b: the vector model has more than the print files draw. Outline strokes, gradients as gradients, clip paths and embedded pictures
  are listed on the file ("... holds outline strokes, which the print files do not draw yet") and not drawn; gradients print as their
  first stop. Raster uploads go through W7b's reader, which needs a database, so the integration run is owed to CI; upload an ICC
  profile (a file kind is W0's to add); re-run cases 2 and 3 on the intake's output files.
- W7d: re-run case 5 on a recorded reading (the stand-in reader marks a design "read from a picture" and moves its colours).
- W1: the real graded pattern and its review state. `lib/print/server/pattern-source.ts` (`patternFor`) is the one function that
  changes: it still returns the two benchmark patterns at EU 48. The library's `getBlock` gives a graded set to build from.
- W4: wire `createPrintFileBuilder` (or `releasePrintBuilder`, which loads the design) into `lib/releases/builder.ts`, and send the
  roster to `POST .../print-files`.
- Owner: P1 (technician review), P5 and P14 (print house profile and lowest dpi), P7 (league rules), P8 (lettering fonts).
