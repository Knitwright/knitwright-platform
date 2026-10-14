# 0029: The pattern library

Status: Proposed
Date: 2026-10-15
Plan step: `plans/production-outputs.md`, workstream W1

## Context

fashionINSTA's output is one DXF for one size. Read in full on 2026-10-14
(`docs/owner/reference/fashioninsta-2026-10-14/`), it has no layer 4, so no notches, although its
own tech pack tells the cutter to follow them. It does not say whether the outline holds seam
allowance. Its tech pack leaves six points to "confirm" that the DXF answers, and four of its
stated values disagree with its DXF by more than its own tolerance. Knitwright stored a DXF per
job (`pattern_jobs`) and nothing about what was in it.

## Decision

1. **A block is one pattern for one product, wearer and cut, at one version**: the pieces of every
   size (`PatternPiece` of the W0 contract), the points measured from them, the checks that ran,
   what the library added and what it still asks. A new upload is the next version; nothing is
   edited (tables `pattern_blocks`, `pattern_block_sizes`, `pattern_reviews`, append-only like
   `spec_versions`, brand-scoped, row level security, written by the server through two
   `security definer` functions that also number the versions).
2. **The DXF reader reproduces the W0 fixtures exactly** (`lib/pattern-library/dxf/read.ts`):
   layers 1, 2, 3, 4, 5, 6, 7, 8 and 14, the piece's name, size and quantity as text, one file per
   size or one file of every size. Another layer is reported, never dropped without a word.
3. **The DXF writer is deterministic** (`dxf/write.ts`): the same pieces give the same bytes, with
   no date. Cut line, sew line, notches on layer 4, grain line, fold line and the allowance of
   every seam as text. Read-back of our own file gives the same pieces to 0.01 mm.
4. **Net or gross is asked, never guessed.** A file either says whether its outline holds seam
   allowance or the library asks. A net outline is grown by 6 mm at seams and 20 mm at hems, none
   at a fold, and every figure is labelled "Knitwright default, not from your factory" until a
   factory gives its own. The sew line is kept, and measurements are read from it.
5. **Notches are placed at the same share of the way along both sides of a seam**: one on the
   front, two on the back, the shoulder positions on the collar. Notches a file already has are
   kept untouched; only a piece with none is given Knitwright's, and the record says so.
6. **Every point of measure is measured from the pattern** (`measure/`): the 14 tops points where
   they apply, and the points only a pattern gives (cap height, armhole curve, cap curve and
   ease, neckline length, collar cut length, across back), at every size, in tenths of a
   millimetre, with the method as a sentence and the source `measured-from-pattern`. A point that
   cannot be read is listed with the reason, never filled in. `compareToTargets` sets a document's
   figure beside the pattern's and reports "differs from the pattern by".
7. **A set is refused when its front and back would not sew together**: side seams or shoulder
   seams more than 2 mm apart, with the seam and the size named. Armhole against sleeve cap is
   reported as ease, not refused. Missing grain lines, landmarks or notches are warnings.
8. **Review is a record, not a flag.** A named person, a role and a date against one block version
   (`pattern_reviews`). Until one exists every file says "Draft pattern, not reviewed." DXFs are
   built on download so they carry the present review line.
9. **Slots, not gaps.** Products fashionINSTA cannot draft (shorts, singlet, skort, hoodies, track
   jacket, raglan jersey, polo with a knit collar) have a slot that says "No pattern yet: needs a
   technician's draft or your DXF." Socks are a `knit-programme` slot that holds a size map and a
   note on the factory's file, never pieces.
10. **Owner-only while in trial**: `patternLibraryOpenTo` (`lib/patterns/access.ts`), the same
    rule as the pattern bridge, without needing the bridge to be set up.

## Evidence

`dxf/read.test.ts` reads both benchmark DXFs to exactly the W0 fixtures. `measure/measure.test.ts`
reproduces the plan's section 1 values to 1 mm and the "differs from the pattern by 1.4 / 1.1 /
0.7 / 0.7 cm" for the jersey's hem width, sleeve length, bicep and cap height. `set.test.ts` stores
seven sizes by four pieces, measured and checked, and refuses a back side seam moved by 5 mm.
`tests/integration/pattern-library.test.ts` covers numbering, atomicity, append-only and review.

## Alternatives

- Keep storing only the DXF file: rejected, nothing could be measured, compared or checked.
- Reading landmarks by shape for any template: rejected for now. The benchmark lists its turn
  points in a fixed order and the library relies on that; a file that differs gets no landmarks
  and a sentence saying so, and a person can place them by hand (stored on the block).
- A `status` column on the block: rejected, "reviewed" is derived from the review rows so the two
  can never disagree.

## Consequences

Samples of the files from another pattern tool may not list turn points the same way. Those get
sew-line-free, landmark-free pieces with warnings until a person places the landmarks. The values
in `docs/launch` and the tech pack that read measurements (W5) import `lib/pattern-library/measure`
and the stored `pattern_block_sizes.measurements`; they must not recompute them. Open: a real
technician review, real graded size sets (the tests use a scaled stand-in, labelled so), and a
storage type for a sock factory's knitting file.
