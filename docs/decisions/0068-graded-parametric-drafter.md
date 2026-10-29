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

---

# 0068 revision 1: the drafter after owner decisions 6 to 10

Status: Proposed; the owner questions of the original are answered by the decisions below, and four new ones are raised
Date: 2026-10-30
Plan step: plans/platform-v5.md, wave 1, workstream X3b (owner decisions 6 to 10). No migration.

## Context

The five owner questions above have been answered by the orchestrator, as plan v5 decision 5 allows: decisions 6 to 10 of
`plans/platform-v5.md` settle the drop-tail convention, make every drafting number data, define what a POM measures, fix the
status of the reference pattern pack, and say what an article needs before it may go `live`. This revision records what the
drafter does about each. Nothing outside `apps/web/lib/parametric/**` changed, and no migration was added.

## Decision

6. **`draft_constants` is per article, labelled, and the drafter's only source of numbers** (decision 7). Every number the
   drafter draws with now lives in `lib/parametric/data/draft-constants.json`, read through a `DraftConstantsSource` so that a
   factory's own row replaces the seed exactly as X1's catalogue will replace the bundled `article.json`. The seed holds the
   Bezier control points of the front and back neck and armhole, the sleeve cap's control points, its 3 mm total ease and the
   bracket and halvings of its solve, the armhole notch distances and the 5 mm notch slit, the rib quartering, the drop-tail
   convention, the K02 cuff's two numbers and spec F-S3's 2 mm master-pattern tolerance. Each group carries its rulebook
   entry, a provenance line naming the line of `tools/draft-pattern.ps1` or of `article.json` it came from, and the label
   "Knitwright draft v0.1, not reviewed by a factory"; a group of numbers no label covers fails the Zod parse, so a constant
   cannot arrive unlabelled. An article with no constants on file answers "not drafted yet" rather than falling back on a
   default.

   **No table and no settings row.** `draft_constants` is a field of a base article, not a platform setting: it is per
   article, set by a factory, and read in the same breath as the article's POM table. Splitting it into a settings row would
   put one article's data in two stores and make a pure, deterministic drafter depend on the database. The seam is the source
   interface, and the committed JSON is the seed behind it, which is why this workstream added no migration.

   The constants are proved live rather than decorative: moving `ease_mm` to 6 mm moves the drafted cap ease to 6 mm, and a
   test that strips comments and strings from every file of the drafting layer asserts that the only numbers left are 0, 1 and
   2, which are an index, a count, and the halving or doubling of a half measurement. The golden byte tests passed unchanged
   through the move, which is the evidence that no value was altered while being lifted out.

7. **The cap ease must sit inside the window the article allows.** `article.json` gives `sleeve_cap_ease_target` as 0 to 6 mm
   (R-PAT-007) and the constant gives 3 mm. An ease outside that window is refused as "not drafted yet" under R-PAT-007
   instead of being drawn, so the window is a check rather than a comment.

8. **`back_drop_tail` is drafted to decision 6's convention, and the convention is data.** The four facts, that the hem is
   level from centre front to the side seam, that the drop begins at the side seam, that the side-seam length is unchanged so
   the front hem never moves, and that the back hem falls on one smooth curve to the centre back, horizontal where it meets
   the fold, are fields of `drop_tail.convention` rather than lines of TypeScript. A convention on file that this script
   cannot draw stops the drop tail with R-PAT-005 and leaves the level hem alone, so each of the four facts is load-bearing
   and each is tested by being contradicted.

   The hem is one cubic Bezier per half, from the side seam at the front hem's level to the fold at the drop, with both
   control points level with their own end. That makes the hem level where it leaves the side seam and level where it meets
   the fold, which is the only reading of decision 6 that keeps the hem direction continuous across the side seam. The two
   control fractions that place those handles are the one part of the hem no measurement in the pack gives, so they are a
   labelled default (0.5 and 0.5, a symmetric curve) with an owner question against them.

   `back_drop_tail = 0` still draws the reference script's two-point level hem, point for point, so the committed pattern pack
   is byte for byte unchanged at the default.

9. **A POM is measured to the finished edge, and the K02 cuff seam is derived** (decision 8). POM D is the finished sleeve
   edge, cuff included. For K02 the sleeve piece therefore ends at D less the cuff's finished depth, and its width there is
   read off the underarm taper between the bicep and the opening rather than assumed to be the opening; the K01 sleeve still
   ends at D itself, which is what makes the K02 seam derived rather than equal. The cuff is a folded rectangle: twice the
   finished depth plus two seam allowances deep, and the sleeve opening less `rib_negative_ease` long, cut two in the rib
   fabric and joined on the rib allowance rather than the K01 hem turn-up. The 25 mm finished depth is `article.json`'s own
   K02 option name. `rib_negative_ease` has no source anywhere in the pack, so it is a labelled default of 20 mm with an owner
   question against it.

   C02 and C03 stay "not drafted yet". A collar outline is a shape, not a number, and nothing in the pack implies one; C03's
   front drop stays C01's 85 mm when the factory's block shape arrives, as decision 8 says, which is a note for whoever
   drafts it and not geometry this workstream wrote.

10. **The reference pattern pack is immutable evidence, and the XS deviation is recorded rather than removed** (decision 9).
    `docs/spec/articles/JSY-SS-01/pattern/` stays exactly as the factory received it and **is never regenerated** from the
    port. The deviation is the two self-intersecting loops at the XS back underarms, **0.063 mm** each, which offsetting the
    back armhole outward by 6 mm leaves where two neighbouring corners overshoot each other. `loops.ts` cuts them off at
    their crossing point, so the platform ships a cuttable path and the pack keeps the fault it was sent with. The whole
    difference is two vertices and 0.13 mm of perimeter on one polyline of one size; `golden.test.ts` asserts that the XS back
    cut line is the only part of any file that differs, and a sweep of all seven committed DXFs finds exactly those two
    crossings and no others. The loops are a fault in the original to raise with the factory; they are never copied forward,
    and the port is not "fixed" to reproduce them.

11. **The master-pattern contract is written down; the gate is wave 3's** (decision 10). `master-pattern.ts` holds the types,
    which are the signed pattern with the name, role and date of the person who signed it, the source it is read from, the
    per-seam deviation and the tolerance, and a stub whose answer today is "No master pattern on file", which blocks `live`. A
    master pattern that does arrive answers "not checked yet", which also blocks `live`, because an unchecked master is not a
    checked one. `mayGoLive` is true only for a checked master with at least one seam and every seam inside the tolerance.
    Nothing here compares geometry: Z8 implements the comparison and the gate, and the drafter stays authoritative for what
    the platform produces while the factory's master stays authoritative for whether an article may be sold. The 2 mm is spec
    F-S3's, held as a drafting constant like every other number.

## Evidence

- **The constants move changed nothing.** Every golden byte test of the original, which is six of seven sizes byte-identical
  to the committed DXF and SVG, the XS back cut line the only departure, and `pattern-report.md` row for row, passes
  unchanged after every number was lifted into the data file. A separate test asserts the drafting layer holds no number but
  0, 1 and 2.
- **The drop tail, every size by every value of its 0 to 40 mm range in 10 mm steps.** The side-seam length is identical on
  the back and the front and identical to the level draft; the front piece is equal point for point to the front of the level
  draft, hem included; the back hem drops by exactly the drop tail and only at the fold; the last hem segment before the fold
  is within a hundredth of level and the hem is flattening as it arrives; every cut and sew outline of every piece is closed,
  has an area, has no repeated point and does not self-intersect; and every point of measure is built within 0.5 mm. The
  convention is also contradicted one field at a time, and each contradiction stops the drop tail under R-PAT-005.
- **K02, every size.** The cuff seam sits at D less the cuff depth and the finished edge is back at D; the sleeve's width at
  the seam lies strictly between the opening and the bicep; the cut rectangle measures twice the finished depth plus two
  allowances by the opening less the negative ease plus two allowances; the body, the sleeve cap and the neck rib are equal
  to K01's; the cuff is joined on the rib allowance; and panels stay closed and non-self-intersecting with the length offsets
  and a 40 mm drop tail applied at the same time.
- **Determinism.** The review pack is built twice with a drop tail and twice with K02 and compared whole, as the original does
  for the length offsets.
- 219 unit tests; 99.7% of statements and 97.9% of branches of `lib/parametric`.

## Consequences

- The drafter's signatures changed inside `lib/parametric`: `draftArticle`, `draftAllSizes` and `reviewPack` take one
  `DraftSources` object (`{ articles, constants }`) in place of a bare `ArticleSource`, and `ArticleScript` is handed the
  article's constants. Nothing outside `lib/parametric` called any of them, so no other workstream is affected.
- A drop tail or a K02 cuff changes the review files, as it should: the back cut line gains the hem curve, the report gains a
  back-hem length row and a centre-drop check row, and K02 adds a fifth piece with two length rows of its own. The default
  draft, which is no drop, K01 and C01, is byte for byte what it was, so the reference comparison still means something.
- A factory that wants a different block changes `draft-constants.json` (later, its own row) and not the code. A factory that
  wants a different drop-tail convention changes the convention fields, and the drafter then says it cannot draw it instead of
  drawing something else.
- **`R-GAP-000` is used for one further check:** the master-pattern tolerance and the "no master pattern on file" report. The
  rulebook describes the garment, not the platform's own gate, so it has no entry for it. The four uses listed in the original
  are unchanged.

## Owner questions

1. **The two drop-tail control fractions.** Decision 6 fixes where the hem starts, where it ends and that it is horizontal at
   the fold, which leaves one degree of freedom: how fast it leaves the side seam and how long it flattens into the fold. Both
   are seeded at 0.5, a symmetric curve. Does the factory's own shirt-tail block use a flatter or a fuller curve?
2. **`rib_negative_ease` for the K02 cuff.** Seeded at 20 mm against a 300 to 420 mm sleeve opening. The pack gives no cuff
   ease anywhere; the only comparable figure is the neck rib's 0.85 ratio (R-PAT-008), which would be 45 to 63 mm on the same
   openings and is a ratio rather than a subtraction. What negative ease does the factory's 1x1 rib cuff take, and is it a
   millimetre figure or a ratio of the opening?
3. **Which width the cuff is cut to.** Decision 8 says the cuff is "the sleeve opening less a labelled `rib_negative_ease`
   default", and the drafter reads that as POM F, the finished opening. The sleeve's own edge at the cuff seam is wider than
   that: at size M it is 350.95 mm around against the opening's 340 mm, because the sleeve tapers over the cuff's depth.
   Cutting to POM F means the rib is stretched by that much more when it is joined. Is POM F the intended width, or should the
   cuff be cut to the sleeve edge it is sewn to, less the ease?
4. **The cuff's notches.** R-PAT-006 quarters the neck rib and says nothing about a cuff, so the cuff carries none. Does the
   factory want a notch at the underarm seam?
