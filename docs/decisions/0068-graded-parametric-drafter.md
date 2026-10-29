# 0068: The graded parametric drafter

Status: Proposed; owner questions listed
Date: 2026-10-29
Plan step: plans/platform-v5.md, wave 1, workstream X3 (spec F-S3 geometry). No migration.

## Context

The spec's base articles carry their geometry as a parametric script (`docs/spec/02-features.md`, F-S3): a graded POM table plus
factory-approved parameter ranges, from which the panel geometry is recomputed whenever a parameter changes. The worked base
article `JSY-SS-01` ships that script as PowerShell, `docs/spec/articles/JSY-SS-01/tools/draft-pattern.ps1`, together with the
files it produced: a DXF and an SVG per size XS–3XL, a graded nest SVG and `pattern-report.md`. Those committed files are the
only record of what the factory was sent, so they are the reference the platform's drafter has to agree with.

Nothing in the platform drafted an article from a POM table before. `lib/pattern-library` holds blocks and a DXF writer,
`lib/production/contract` holds the pattern-piece types the rest of the production chain already reads, and X5 will take graded
panels through an interface. This workstream supplies the geometry behind both.

## Decision

1. **A line-for-line port, not a re-draft.** `apps/web/lib/parametric/` reproduces the PowerShell script's arithmetic in the same
   order, so the same input gives the same doubles: `geometry.ts` (Bézier sampling at 61 points, polyline length, arc-length
   point and tangent, per-edge mitred seam-allowance offset, 5 mm notch slits), `jsy-ss-01/curves.ts` (the neck and armhole
   Béziers and the 40-halving bisection that solves the sleeve cap height), `jsy-ss-01/pieces.ts` (front, back, sleeve, C01 neck
   rib) and `jsy-ss-01/index.ts` (the POM table, the checks and the seam lengths). `format.ts` reproduces .NET's
   `ToString('0.##')`, which takes a double to 15 significant digits and then rounds half away from zero; the rounding is done on
   the digit string because this package targets ES2017 and has no BigInt. The cap keeps the script's 3 mm total ease, inside the
   article's 0–6 mm target (R-PAT-007), and the rib keeps `neckline × 0.85` (R-PAT-008).
2. **The review writers reproduce the reference files.** `review/` writes the same per-size DXF (R12 ASCII, mm, y flipped;
   layers 1 cut, 14 sew, 4 notch, 7 grain, 15 text, 13 drill unused because this article has no drill holes), the same per-size
   SVG at 1:1 and the same graded nest SVG, plus `pattern-report.md`. A graded nest DXF is added, which the reference script
   never wrote. Output depends only on the article and the input, so the same request gives the same bytes.
3. **One deliberate departure from the reference bytes.** Offsetting the XS back armhole outward by 6 mm makes the two
   neighbouring corners at each underarm overshoot each other, leaving a self-intersecting loop of 0.063 mm. A cutter cannot
   follow a loop, and spec F-S3 requires closed, non-self-intersecting panels, so `loops.ts` cuts loops spanning at most eight
   edges off at their crossing point; a wider crossing is a real fault and is left for `validate.ts` to report. This changes the
   XS back cut line and nothing else.
4. **The production contract, not a new shape.** `contract.ts` maps each drafted piece to the existing
   `lib/production/contract` `patternPieceSchema` and every size to `gradedPatternSchema`, negating y for the contract's y-up
   DXF frame, and writes AAMA-style DXF through the existing `lib/pattern-library/dxf/write.ts`. No pattern type was added or
   changed.
5. **A script registry, so more articles plug in.** `draftArticle(code, size, params)` and `draftAllSizes(code, params)` look
   the code up in `ARTICLE_SCRIPTS`. An article with no script — `SHO-TR-01` and the other six launch articles — answers
   `not-drafted-yet` with the reason. Article data comes through an `ArticleSource` interface; until X1's catalogue exists, the
   spec's `article.json` is bundled as `data/JSY-SS-01.json` and a test keeps the copy equal to the committed original.
6. **Nothing is guessed and nothing is clamped.** A value outside a parameter's range, off its step, of the wrong type, or naming
   an option or size the article does not offer, is refused as `invalid` with a finding per value. Geometry the article does not
   define answers `not-drafted-yet` with the rule that explains it: collars C02 and C03, sleeve finish K02, `back_drop_tail` at
   any value but its default, and any option group or parameter a later `article.json` adds that this script has never drawn.
   Every finding and gate carries a rulebook id from `docs/spec/articles/JSY-SS-01/rulebook.md`; the four checks the rulebook has
   no entry for use `R-GAP-000` (listed under Consequences).

## Evidence

- **The port is byte-identical to the reference for six of the seven sizes.** Generating the pack and comparing with `cmp`:
  `S`, `M`, `L`, `XL`, `2XL` and `3XL` match the committed DXF and SVG exactly. `XS` differs only in its back cut polyline
  (the third polyline of the file), by two vertices and 0.13 mm of perimeter — the two trimmed loops of decision 3 above.
  `pattern-report.md` differs only in the line naming the generator. `golden.test.ts` asserts exactly this, part by part, so a
  regression anywhere else in those files fails the build.
- **The reference geometry measures back to the POM table, and so does ours.** `golden.test.ts` reads the sew lines straight out
  of a review DXF and recovers all eleven points of measure A–L from translation-free spreads and drops, knowing nothing about
  how the file was produced. For all seven sizes the committed DXF and the port's own DXF both measure to `article.json`'s POM
  values exactly. This replaces the self-referential check the draft had, where five of the ten rows compared a value with
  itself.
- **The reference XS back is the only self-intersecting outline in the pack.** A test sweeps every polyline of all seven
  committed DXF files and finds exactly two crossings, both on the XS back cut line, which is the evidence for the departure
  above rather than a comment claiming it.
- **F-S3 acceptance.** Every size × both length parameters at both range ends and their default (63 combinations) gives closed
  panels with no repeated point, an area and no self-intersection, on all four pieces, and every POM within 0.5 mm.
- **Determinism.** The pack is built twice and compared, including the sha256 of the nest DXF; the production DXF is written
  twice and compared.
- **The spec's Phase 0 test matrix** (`docs/spec/04-production-package.md`): the production DXF's piece outlines are closed
  (code 70 = 1, first vertex repeated), every cut and sew outline is within 0.5 mm of the drafted geometry, and the layers are
  the spec's.
- 108 unit tests; 100% of statements, branches, functions and lines of `lib/parametric`. `pwsh` is not installed here, so the
  reference script was not re-run; the committed files it produced were parsed instead.

## Alternatives

- **Re-drafting the block from the POM table rather than porting.** Rejected: the committed DXF and SVG are what the factory
  reviews, and a drafter that cannot reproduce them has no reference to be judged against.
- **`@freesewing/core` (MIT), which F-S3 names as an option.** Rejected for this article: the reference script's output is the
  acceptance criterion, and matching it through another library's curve and offset code is harder than porting 200 lines. No
  dependency was added by this workstream, so there is no new licence to record.
- **Keeping the XS loops for byte-exactness.** Rejected: F-S3 requires non-self-intersecting panels, and a 0.063 mm loop is a
  cutting-path fault. The loops are trimmed and the departure is measured and tested.
- **Drafting `back_drop_tail`, C02, C03 and K02 from their names.** Rejected: `article.json` gives these ranges and names but no
  geometry, and a drafted shape nobody has sampled is exactly the invented measurement the plan forbids. They answer
  "not drafted yet" with their rule instead.

## Consequences

- X5's production package can take graded panels for `JSY-SS-01` in every size through `toGradedPattern`, and X4 can read
  parameter ranges and findings. Neither needs to know the article's geometry.
- A second article needs one `ArticleScript` in `lib/parametric/` and a row in `ARTICLE_SCRIPTS`; nothing else changes. Until
  then seven of the eight launch articles answer "not drafted yet", which is the honest answer and not a failure.
- When X1's catalogue lands, `BUNDLED_ARTICLES` is replaced by a database-backed `ArticleSource`. The bundled copy and its
  equality test are the seam, and `data/JSY-SS-01.json` is then deleted.
- The port is tied to the reference script's exact arithmetic. That is deliberate while the pattern is under factory review, and
  it is what makes the golden test meaningful; it also means a change to a curve must be made in the article's script and the
  port together, or the golden test will say so.
- **`R-GAP-000` is used for four checks the rulebook has no entry for:** a parameter key the article does not define, an option
  group the article does not define, an option code that is not in its group, and a size the article is not graded to. All four
  are "the request names something the catalogue does not offer", which the rulebook does not cover because it describes the
  garment rather than the request.

## Owner questions

1. **The drop tail.** `R-PAT-005` and `article.json` both allow `back_drop_tail` 0–40 mm in 10 mm steps, but neither says what
   the hem curve is: where the drop starts across the back, whether the side seam length is kept, and whether the front hem
   changes. It is refused as "not drafted yet" rather than guessed. Please give the hem shape, or confirm it waits for the
   factory's pattern master.
2. **Collars C02 and C03 and cuff K02.** `article.json` names them with a binding width, a V drop of 140 mm and a 25 mm finished
   cuff, but not the neckline or sleeve geometry that goes with them — in particular whether POM D is measured to the cuff seam
   or to the finished sleeve edge for K02, and whether C03 keeps C01's 85 mm front drop. All three are refused. Please confirm,
   or confirm they wait for the sample round.
3. **The 3 mm sleeve cap ease.** The reference script fixes 3 mm inside the article's 0–6 mm target, and the port keeps it. Is
   3 mm the intended value for the factory, or should it become a `draft_constants` entry the factory can set per article?
4. **The XS underarm loops.** The committed XS DXF has two 0.063 mm self-intersecting loops; the port trims them, which is the
   only place its files differ from the pack's. Should `docs/spec/articles/JSY-SS-01/pattern/` be regenerated from the port so
   the committed reference and the platform agree byte for byte, or does the pack stay as the factory received it?
5. **Who is the drafter's authority.** F-S3 says the script's size-M default output is checked against the factory's master
   pattern within ±2 mm at article creation. There is no master pattern in the repo, so that check is not implemented. Where
   will the master come from, and should the check block an article going `live`?
