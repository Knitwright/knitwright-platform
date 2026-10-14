# Plan: production outputs that beat the fashionINSTA benchmark

Status: DRAFT for the owner. Written 2026-10-14 by the planning agent. Nothing here is built.
Goal (owner, 2026-10-14): "Cover the gaps in my platform and make sure the results I give are
better than fashionINSTA's."
Benchmark: `docs/owner/reference/fashioninsta-2026-10-14/` (crew tee and No. 10 polka-dot
jersey, EU 48, DXF and tech pack PDF each).
Builds on: `plans/knitwright-mvp-blueprint.md` v3.1 (layers A, B, C, R and F), decisions
0001 to 0027, `plans/design-reference.md`. Where this plan and the blueprint disagree, the
blueprint's shared context (provenance, units, invariants I1 to I6, anti-patterns) wins.

## How to use this plan

Seven workstreams. **W0 lands first** (one small PR, then a second for the dot pattern). After
W0a merges, **W1, W2, W3, W4 and W6 run in parallel** in separate cloud agents, each on its own
branch `feat/prod-w<n>-<slug>` cut from `main`. **W5 runs in two phases**: phase A in parallel
with the others, phase B after W1 to W4 merge. Each agent reads, before writing code:

1. "Rules every workstream follows" below.
2. `apps/web/AGENTS.md` (this Next.js is not the one in your training data; read
   `apps/web/node_modules/next/dist/docs/` before any route, page or action).
3. Its own workstream section, and the W0 contract it imports.

An agent edits only the paths its section says it OWNS. A shared path is edited only by its
named owner; anyone else asks on the PR or works around it. A file not listed anywhere belongs
to nobody: leave it alone, or ask.

---

## 1. What the benchmark actually delivered

Read in full on 2026-10-14. The DXFs were parsed with a throwaway script (AAMA/ASTM-style
layers, millimetres): layer 1 cut outline, 2 turn points, 3 curve points, 5 and 7 grain line,
6 fold (mirror) line, 8 internal line. **There is no layer 4, so there are no notches**, although
both PDFs tell the cutter to follow notches. Each piece says `ANNOTATION: CUT` and nothing says
whether seam allowance is in the outline. One size (48) only; the "grade rule table" is a name
with no rules.

Measured by the planner from `pattern_1598.dxf` (jersey) and `pattern_1597.dxf` (tee). These are
reference values for tests; an implementer re-derives them and asserts within 1 mm.

| Point | Jersey DXF | Jersey PDF says | Tee DXF | Tee PDF says |
|---|---|---|---|---|
| Body length, HPS to hem (front) | 72.0 | confirm | 68.7 | confirm |
| Shoulder seam | 10.6 | confirm | 10.4 | confirm |
| Neck width, front half x 2 | 18.8 | confirm | 19.1 | confirm |
| Front neck drop | 9.6 | confirm | 9.8 | confirm |
| Back neck drop | 2.6 | not given | 2.7 | not given |
| Chest, flat at underarm | 50.7 | 50.5 (2.5 below) | 50.7 | 50.5 |
| Hem width, flat | **51.9** | 50.5 "straight side seam assumed", tol 1.0 | **51.9** | 50.5 |
| Sleeve length, cap top to hem | **20.5** | 21.6, tol 0.5 | **20.5** | 21.6 |
| Bicep, flat | **18.6** | 19.3, tol 0.5 | **18.6** | 19.3 |
| Sleeve cap height | **13.8** | 14.5, tol 0.3 | **13.8** | 14.5 |
| Sleeve opening, flat | 17.3 | confirm | 17.3 | confirm |
| Armhole, front + back curve | 23.4 + 24.6 = 48.0 | 48.0 | | 48.0 |
| Sleeve cap curve | 48.0 (ease 0.0) | zero ease | | zero ease |
| Neckline, full | 50.1 | 50.0 | | 51.0 |
| Collar cut | 3.8 x 42.6 on fold | 3.8 x 42.6 | 4.2 x 38.2 | 4.2 x 38.2 |

So the benchmark leaves six points as "confirm" that its own file answers, and **four of its
stated values disagree with its own DXF by more than its own tolerance** (hem width, sleeve
length, bicep, cap height). Every one of these is a mechanical measurement of geometry the
tool already had.

### Section by section: benchmark, Knitwright today, what we must do better

| Section | fashionINSTA benchmark | Knitwright today (cite) | Must be better by |
|---|---|---|---|
| Cover | Style, client, season, sample size, range "graded set pending", pattern source, draft basis, fabric, stretch reduction, revision | Style, season, brand, type, wearer, version, base size, size run, options, named revision history (`lib/techpack/cover.ts`) | Add pattern block and its version and review state, base fabric with tested stretch and shrink, decoration method, release id. Range is a real graded set, never "pending". |
| Design / flats | Front and back sketch with artwork | To-scale flats with callouts, one drawing per colourway, kit patterns, player marks (`lib/flat/*`, `lib/techpack/flats.ts`) | Already ahead on callouts. Add the dot repeat (no `dots` style exists in `lib/garment/kit-pattern.ts`) and a print-zone overlay. |
| Artwork and colour | C1 to C4 with Pantone TCX target and screen hex; dot repeat spec; print-file rules in prose (1.5 cm bleed, pre-shrink 1 to 3 %, match rows at seams, 150 dpi, printer profile) | Colourway table: factory code plus screen colour (`ColourwayRow`); artwork table with panel, anchor, offsets, size, rotation, technique (`ArtworkItem`) | A colour-standard table with a role per colour; a machine-checked repeat spec; the print rules are not prose but the parameters the print files were actually built with (bleed, scale, dpi, profile), per piece and size. |
| Placement | HPS-referenced positions at EU 48 only | Anchors and offsets, one set (`lib/techpack/artwork.ts`) | A placement table for every size, measured on that size's pattern piece from HPS and CF, inside named zones with their clear space. |
| Points of measure | 18 rows, one size, 6 "confirm", 4 contradict the DXF | 14 registry points (`lib/garment/registry/tops/points-of-measure.ts`), graded across the run from starter or brand charts, each with provenance (`lib/techpack/measurements.ts`); nothing from a pattern | Every applicable point at every size **measured from that size's pattern**, shown beside the target with the difference, flagged when outside tolerance. Plus pattern-only points: cap height, armhole and cap curve lengths and ease, neckline length, collar cut length and notch positions, across back. |
| Bill of materials | Full list, consumption "~1.2 m, confirm from marker" | Fabrics with composition, construction, gsm, finish, stretch (`none/two-way/four-way`), consumption as typed (`lib/garment/parts.ts`) | Consumption per size from the cut list, with the efficiency assumption named; sublimation paper and ink lines for sublimated designs; stretch and shrink as tested percentages. |
| Construction | Ordered operations with machine, SPI, notes; print, calender, cut first | Seams with seam class, stitch class, density, proposals flagged (`lib/techpack/construction.ts`) | Add the ordered operation sequence (print, press, cut, sew, decorate, inspect) built from the technique and seams, proposals flagged; seam allowance per seam read from the pattern. |
| Cutting | Piece, qty, fabric, grain, fold, notches (notches absent from the DXF) | None | A cut list from the pattern itself, per size: piece, quantity, mirrored, on fold, grain, fabric, notches actually present, area, fabric use. |
| Labels and packing | Prose | Labelling section (`lib/techpack/labelling.ts`) | Equal; no work. |
| Grading | "Only EU 48 is drafted" | Graded table from charts | A graded pattern, every size measured. |
| Open items | Hand-written list | Suggested values page and a count of things to confirm (`lib/techpack/suggested.ts`, `completeness.ts`) | A "ready for the factory" checklist computed from records, each open item naming who must act. |
| Sign-off | Empty role table | Always empty (`lib/techpack/sign-off.ts`) | Named, dated, role-bearing records against a frozen release, including the strike-off. |
| Print files | None | None | 1:1 file per piece per size, bleed, shrink scale, profile, clear space. |
| Per-player files | None (advice to put numbers on a layer) | Player-mark placement only; roster deliberately not built (decision 0027) | Roster, manifest and one print or transfer set per player. |
| Reorders | None | Append-only spec versions (`supabase/migrations/20260929020000_projects.sql`) | A frozen release: spec version, pattern version, fabric test, print parameters and a SHA-256 for every file, so a reorder rebuilds byte-identical files or says why not. |

---

## 2. The gap list against the codebase

| # | Gap | Exists today | Missing | Workstream |
|---|---|---|---|---|
| 1 | Pattern library | `pattern_jobs` table and `claude-bridge` (`supabase/migrations/20261013010000_patterns.sql`, `apps/web/lib/patterns/*`, `apps/web/scripts/pattern-bridge.mts`): one DXF per job, one size, stored as a file. One sample DXF (`docs/owner/patterns/fashioninsta-mens-knit-tee-50.dxf`). | A library per product: graded set, per-size pieces, seam allowance, notches, grain lines, checks, review state. No DXF reader or writer in the code (`grep dxf` finds only file-type strings). Products fashionINSTA cannot draft (football shorts, singlet, skort, hoodie, track jacket, raglan, knit polo collar) need import slots; socks are a knitting programme, not a pattern. | W1 |
| 2 | Size charts | 39 starter charts for 13 launch garments (`apps/web/lib/sizing/charts/starter-*.ts`, sources in `docs/sizing/starter-charts.md`); brand chart import (decision 0015); size systems adult, youth, sports bra (`lib/garment/registry/size-systems.ts`). Men XS to 3XL, women XS to 2XL, youth YXS to YXL. | Australian labelling (women to 3XL; junior sizes as Australian clubs name them), men's and women's cuts of one product, and a map from each label to the pattern size it is cut from. | W2 |
| 3 | Fabric data | Per-design fabric fields: gsm, stretch as a category (`lib/garment/parts.ts`). | A base-fabric library with stretch % (length, width), recovery, sublimation shrink % (length, width), usable width, each value with its source; reduction and print scale computed from them. | W2 |
| 4 | Print zones | Anchors for artwork and player marks (`lib/garment/names-numbers.ts`, flat templates in `lib/flat/templates/*`). | Zones per template in pattern-piece coordinates (crest, sponsor, front number, back name, back number, sleeve badge, sleeve band); minimum text height and line weight; colours that sublimate badly; league number rules. | W3 |
| 5 | 3D in pattern coordinates | A stylised 3D form inflated from the flat outline (`lib/garment3d/*`, decision 0014, behind `SHOW_3D`). | Any link between 3D surface and pattern pieces. | W6 (spike only) |
| 6 | Print files | Exports are PDF, Excel, SVG of the tech pack (`lib/techpack/exports/formats.ts`). Kit patterns cut to the flat outline (`lib/flat/kit-pattern.ts`). | Artwork on every piece in every size, bleed, shrink scale, profile, clear space, 1:1 PDF, TIFF, SVG. | W3 |
| 7 | Per-player files | Player-mark places and one sample (`lib/garment/names-numbers.ts`, `lib/flat/player-marks.ts`). | Team roster, manifest, one file set per player. | W4 (roster), W3 (files) |
| 8 | Fuller tech pack | 11 sections, provenance on every cell, wording guard (`lib/techpack/*`, `lib/techpack/wording.test.ts`). | Artwork and colour page, measured graded spec, cut list, fabric page, operation sequence, proof and named sign-off, factory-ready definition. | W5 |
| 9 | Cut list and marker | Nothing. Blueprint layer C names `MarkerProvider`, candidate `spyrrow`, untested. Quote requests exist (`lib/leads/quote.ts`) but no instant price. | Fabric use per size from piece areas and fabric width, a marker interface, and a number the future instant price can read. | W2 |
| 10 | Strike-off sign-off | Nothing. | Strike-off record with photos, measured shrink and colour result, named acceptance. | W4 |
| 11 | Frozen release | Versions are append-only. | A release that freezes spec, pattern, fabric test and print parameters with file hashes; reorders from it. | W4 |

---

## 3. Rules every workstream follows

- **No invented measurement.** Every number a factory reads carries a source. Two new sources
  are added by W0: `measured-from-pattern` (read from a pattern piece's geometry) and, in the
  fabric library's own enum, `fabric-test` (a named test record). A default the code needs to
  run, such as a 15 mm bleed, is a **setting** with the label "Knitwright default, not from
  your print house", never a measurement.
- **Missing owner input never blocks the build.** It blocks only the "ready for the factory"
  check (W5), which names what is missing and who supplies it. Files can still be produced,
  marked in their margin, for example "Not scaled for shrink: this fabric has no shrink test."
- **Units.** Stored measurements stay integer tenths of a millimetre. Pattern geometry is
  millimetres as floats (DXF's own unit), rounded to 0.01 mm on write.
- **Wording.** `lib/techpack/wording.test.ts` forbids checked, verified, approved, confirmed,
  final, production-ready, passed, validated, certified, except in listed sentences that say
  something is NOT done. Records of real people use "reviewed by", "accepted by", "signed by"
  with a name and a date. Plain words from `lib/copy/vocabulary.ts` lead in the UI ("factory
  file", "extra fabric at the seams", "size steps"). Never write "production-ready".
- **Immutability, small files, TDD.** New objects, never mutation; files under 400 lines,
  functions under 50. Tests first. Coverage: 80 % overall; 90 % on every new `lib/` directory
  listed here (W0 adds the thresholds).
- **Exports built on download** (blueprint cost rule 6) still holds: a release stores the
  inputs and a SHA-256 per file, not the files. Renderers must therefore be deterministic: no
  creation date, random id or unordered map in any output.
- **Server only writes.** Every new table: brand-scoped, row level security on, members read
  their own brand, no browser write grant, writes through `defineRoute` / `defineAction` with
  the service client, as `pattern_jobs` does. No cross-workstream foreign keys: a release
  refers to other workstreams' rows by an immutable JSON snapshot, so migrations merge in any
  order.
- **No MCP at runtime (I2).** FashionInsta is reached only by the owner's bridge script.
- **Gate before every PR:** `pnpm --filter web typecheck`, `lint`, `test:cov`, `build`, `e2e`,
  plus `test:db` for any migration.

---

## 4. Migration timestamps (assigned, do not change)

| Timestamp file | Workstream | Holds |
|---|---|---|
| `20261015000100_production_file_kinds.sql` | W0 | Adds file kinds `print`, `proof`, `roster`, `pattern-source` to `files_kind_check`; adds `image/tiff`, `image/svg+xml`, `text/csv` to the exports bucket's types. Only W0 touches `files_kind_check` or bucket types. |
| `20261015010000_pattern_library.sql` | W1 | `pattern_blocks`, `pattern_block_sizes`, `pattern_reviews`; adds `kind` (`single`, `size-set`) and `block_id` to `pattern_jobs`. |
| `20261015020000_fabrics_and_size_maps.sql` | W2 | `base_fabrics`, `fabric_tests`, `size_label_maps`. |
| `20261015030000_print_profiles_and_rules.sql` | W3 | `print_profiles` (per brand: bleed, dpi, ICC file, max print width), `league_rule_sets`. |
| `20261015040000_team_orders.sql` | W4 | `team_orders`, `team_order_rows`. |
| `20261015040100_releases_and_proofs.sql` | W4 | `production_releases` (append-only, trigger as `spec_versions`), `strike_offs`, `sign_offs`. |
| `20261015050000_*` | spare | Reserved for W5 phase B if it needs one. Any other new migration takes `20261015060000` or later and is announced on its PR. |

---

## 5. Workstreams

### W0. Shared contract and plumbing (lands first)

**Goal.** Give every other workstream one set of types, fixtures and plumbing so they never edit
the same file.

**W0a (blocks everyone, keep it under a day):**

- `apps/web/lib/production/contract/` with Zod schemas and types, each in its own file:
  - `pieces.ts`: `PatternPiece` (id, name, size label, quantity, mirrored pair, on fold, cut
    outline and sew line as closed polylines in mm, notches with seam id, grain line, fold line,
    internal lines, named landmarks such as `hps`, `shoulder-point`, `underarm`, `cf-neck`,
    `cf-hem`, `cap-top`), `SeamAllowance` per edge, `GradedPattern` (block id and version, sizes,
    pieces per size), `PatternMeasurement` (point id, size, tenths mm, source
    `measured-from-pattern`, method sentence).
  - `fabric.ts`: `FabricProfile` (stretch % length and width, recovery %, shrink % length and
    width, gsm, usable width mm), each value `{ value, source: "fabric-test" | "supplier-sheet" |
    "suggested" | "not-set", testId? }`; pure helpers `printScale(shrink)` = 1 / (1 - s) per
    axis.
  - `sizes.ts`: `SizeLabelMap` (label, wearer, cut, pattern size, source).
  - `print.ts`: `PrintZone` (id, piece id, polygon in piece coordinates per size, clear space mm,
    purpose), `PrintProfile`, `PrintRuleSet` (min text height mm, min line mm, colours to avoid,
    number rules), `PrintFileSpec` (piece, size, player?, format, bleed, scale x/y, dpi,
    profile), `PrintFileResult` (bytes hash, page size mm, warnings).
  - `orders.ts`: `RosterRow` (name, number, size label, cut, quantity), `TeamOrder`.
  - `release.ts`: `ReleaseSnapshot` (spec version, pattern block version, fabric test ids, print
    profile, roster hash, file list with SHA-256).
  - `readiness.ts`: `ReadinessItem` (id, met, sentence, who acts: `owner`, `technician`,
    `print-house`, `factory`, `club`).
- `apps/web/lib/production/fixtures/`: the four benchmark pieces of each DXF converted once to
  `PatternPiece` JSON (`tee-eu48.pieces.json`, `jersey-eu48.pieces.json`) with landmarks marked
  by hand from the turn points in section 1; a polka-dot jersey design spec; a 22-player sample
  roster with fictional names. W1's real reader must reproduce these fixtures exactly.
- `apps/web/lib/garment/provenance.ts`: add `measured-from-pattern` with the label "Measured on
  the pattern", and fix the compile fallout in `lib/projects/provenance-tone.ts`,
  `lib/techpack/exports/guard.ts`, `lib/garment/fixtures/arbitraries.ts`.
- Migration `20261015000100_production_file_kinds.sql`.
- `apps/web/lib/server/limits.ts`: every rate-limit key the workstreams need
  (`patternLibrary`, `fabricWrite`, `printFiles`, `rosterImport`, `releaseCreate`, `proofWrite`).
- `apps/web/lib/storage/store.ts`: one helper `storeProductionFile(kind, ...)` for the new kinds.
- `apps/web/vitest.config.mts`: 90 % thresholds for `lib/production/**`, `lib/pattern-library/**`,
  `lib/fabrics/**`, `lib/cutting/**`, `lib/print/**`, `lib/orders/**`, `lib/releases/**`,
  `lib/proofs/**`.
- `apps/web/lib/workspace/tools.ts`: one journey tool `production` ("Make it"), and
  `apps/web/components/production/ProductionPanel.tsx` as a shell that renders four stub
  components, each file owned by one workstream: `patterns/PatternsPanel.tsx` (W1),
  `fabrics/FabricPanel.tsx` (W2), `print/PrintPanel.tsx` (W3), `orders/OrderPanel.tsx` (W4).
- Dependencies: research and add the one new library the plan needs, a polygon offsetter for
  seam allowance and bleed (candidates: a Clipper2 port; check licence, size, maintenance per
  `development-workflow.md`). Record it in `docs/launch/licences.md`. No other workstream adds a
  dependency without saying so on its PR first (the lockfile is the usual merge conflict).
- `docs/decisions/0028-production-contract.md`; reserve rows 0029 to 0034 in
  `docs/decisions/README.md` (status "Planned").

**W0b (second PR, does not block W1, W2, W4):** a `dots` kit-pattern style: dot diameter, pitch,
row step, half-drop, one colour per row (rows A and B), clear space around marks. Owns the
`dots` additions in `lib/garment/kit-pattern.ts`, `lib/flat/kit-pattern.ts`,
`lib/intent/kit-pattern.ts`, `lib/kit-styles/presets.ts` and the one-line description in
`lib/techpack/artwork.ts`. Sizes are not guessed: drawn sizes follow the `DRAWN_SIZES` rule
already in `lib/flat/kit-pattern.ts`.

**Acceptance.** Typecheck, lint, tests green; fixtures load and validate against the schemas;
the production tool opens an empty panel; `test:db` shows the new file kinds accepted. W0b: the
benchmark jersey (white, 3 cm red and royal dots, 7 cm pitch, 3.5 cm row step, half drop) is
expressible and draws on both flats with SVG and PDF read back.

**Owns.** `apps/web/lib/production/**`, `apps/web/components/production/ProductionPanel.tsx`,
the migration above, `docs/decisions/0028-*`, plus the shared edits listed. After W0 merges, those
shared files return to their usual owners (see section 6).

### W1. Pattern library and pattern engine (gaps 1 and 8, measured points)

**Goal.** Knitwright owns a pattern library per product: graded DXF per size, seam allowance,
notches, grain lines, checks and a technician review record. fashionINSTA becomes one source
among several (owner's bridge, technician upload, brand import).

**Build.**
- `lib/pattern-library/dxf/read.ts`: read AAMA/ASTM-style DXF (blocks per piece, layers 1, 2,
  3, 4, 6, 7, 8, 14; piece text `PIECE NAME`, `SIZE`, `QUANTITY`), multi-size files and one file
  per size. Unknown layers kept as warnings, never dropped silently.
- `lib/pattern-library/dxf/write.ts`: write one DXF per size and one multi-size DXF, with cut
  line, sew line, notches on layer 4, grain line, fold line, piece annotation, units in the
  header. Deterministic output.
- `seam-allowance.ts`: offset the sew line per edge (0.6 cm overlock, 2.0 cm hem as defaults
  marked "Knitwright default"), and tell net from gross: a source file says which, or the
  library asks.
- `notches.ts`: notches at landmark distances (single front, double back, shoulder on collar),
  computed from matched seams.
- `checks.ts`: closed outlines; joined seam lengths agree (front and back side seams, front and
  back shoulder, armhole against cap with the ease stated); grain line present; quantities
  sensible; landmarks found. Each failure a plain sentence.
- `measure/`: one function per point of measure, reading landmarks and curves: every registry
  point of `lib/garment/registry/*/points-of-measure.ts` that applies, plus pattern-only points
  (cap height, armhole curve, cap curve and ease, neckline length, collar cut length and
  notches, across back). Output `PatternMeasurement[]` per size.
- `landmarks.ts`: find landmarks from turn points and fold lines per template family, with a
  manual override stored on the block when detection is unsure.
- Library records and service: blocks per product and wearer and cut, versions, status
  (`draft`, `reviewed`), sources (`fashioninsta-bridge`, `technician-upload`, `brand-import`),
  per-size DXF file ids, measured points stored per size.
- Bridge: `scripts/pattern-bridge.mts` accepts a size set (`--dxf-dir` or a multi-size DXF from
  FashionInsta's size-set tool), records a block version, runs checks and measurements.
- Upload route for a technician or brand DXF (`app/api/pattern-library/**`), owner-only while in
  trial (`lib/patterns/access.ts`).
- Products without a fashionINSTA draft (football shorts, singlet, skort, hoodie, track jacket,
  raglan jersey, knit polo collar) get library slots showing "No pattern yet: needs a
  technician's draft or your DXF". Socks get a slot of kind `knit-programme` that holds the
  sock factory's programme file and a size map, never pieces.
- Review record (layer R in the blueprint): a named technician, date and note against one
  block version. Until one exists every file says "Draft pattern, not reviewed."
- UI: `components/production/patterns/**` and `components/techpack/PatternSection.tsx`.

**Acceptance (beats the benchmark).**
- Both benchmark DXFs read; the pieces equal W0's fixtures; the values in section 1 reproduced
  within 1 mm by `measure/`, with zero "confirm".
- The jersey's stated hem width, sleeve length, bicep and cap height are reported as "differs
  from the pattern by 1.4 / 1.1 / 0.7 / 0.7 cm" in a test, proving we catch what the benchmark
  missed.
- Written DXF has layer-4 notches on every joined seam, a grain line on every piece, explicit
  seam allowance and a sew line; read-back of our own file round-trips within 0.01 mm.
- A graded set (men XS to 3XL from the bridge's size set) stores 7 sizes x 4 pieces, every size
  measured, every check run; a set with a seam mismatch over 2 mm is refused with the seam named.
- All 14 tops points (where they apply) plus the 6 pattern-only points measured at every size of
  the jersey set.

**Owns.** `apps/web/lib/pattern-library/**`, `apps/web/lib/patterns/**`,
`apps/web/scripts/pattern-bridge.mts`, `apps/web/app/api/projects/[projectId]/patterns/**`,
`apps/web/app/api/pattern-library/**`, `apps/web/components/production/patterns/**`,
`apps/web/components/techpack/PatternSection.tsx`, `docs/owner/patterns/**`, migration
`20261015010000`, `docs/decisions/0029-pattern-library.md`.

**Depends on.** W0a. Nothing else.

**Tests.** Golden tests on both benchmark DXFs; property tests (offset grows area, offset of an
offset by minus d returns the line within tolerance, notches lie on the outline); round-trip
read/write; RLS tests for the three tables; one e2e: owner uploads a size set, sees the
measured table.

### W2. Sizes, fabrics, cut list and marker (gaps 2, 3, 9)

**Goal.** Store Australian size labels and their pattern sizes, base fabrics with tested stretch
and shrink, and compute fabric use per size.

**Build.**
- Sizing (`lib/sizing/**`): Australian runs: men XS to 3XL, women XS to 3XL (adds 3XL), junior
  sizes as Australian clubs label them (proposed 6, 8, 10, 12, 14, 16, each mapped to the
  nearest youth starter column with source "suggested", owner to confirm); men's and women's
  cuts of one product as two charts under one product. Starter values for new labels follow
  the rules in `docs/sizing/starter-charts.md` and are written there with their sources; where
  no source exists the value is left unset, never guessed.
- `size_label_maps`: label, wearer, cut, pattern size (for example "AU M men's -> pattern 48"),
  source. The default map is "suggested" and the readiness check names it.
- `lib/fabrics/**`: base-fabric library per brand (seeded with the three fabrics the benchmark
  names, every number `not-set`); fabric tests (who, when, method, stretch length and width at a
  stated load, recovery, shrink after pressing at a stated temperature and time) with photos;
  `stretchReduction(fabric, block)` returns the pattern reduction and says when the pattern's
  own reduction (the benchmark's 5 %) does not match the fabric's test; `printScale(fabric)`.
- `lib/cutting/**`: cut list per size from `GradedPattern` (piece, quantity, mirrored, fold,
  grain, fabric, area); fabric use per size = piece area / (usable width x efficiency), where
  efficiency is a setting with the source "Knitwright default, not from a marker" until a
  marker exists; a `MarkerProvider` interface and a simple strip-packing estimator with the same
  label; `fabricUseFor(order)` for the future instant price (the price itself is not built here).
- UI: `components/production/fabrics/**`, a fabric library page under the brand settings.

**Acceptance.**
- A women's 3XL and the six junior sizes exist with provenance shown on every value; nothing
  shown as measured.
- The polyester interlock with a fabric test of 2.0 % length and 1.5 % width shrink gives print
  scale 1.0204 x 1.0152; with no test the scale is 1.0 and the result carries "not scaled for
  shrink".
- The jersey EU 48 fixture gives a cut list of 4 piece types with the right quantities, fold and
  mirror, and a fabric use per size for a 160 cm fabric, each number labelled with its
  assumptions (the benchmark gives one "~1.2 m, confirm from marker").
- A fabric whose test stretch disagrees with the block's reduction raises a plain warning.

**Owns.** `apps/web/lib/sizing/**`, `apps/web/lib/fabrics/**`, `apps/web/lib/cutting/**`,
`apps/web/components/production/fabrics/**`, `apps/web/app/(app)/brands/**/fabrics/**` (new
pages only), `apps/web/app/api/fabrics/**`, `docs/sizing/**`, `docs/owner/size-charts.md`,
migration `20261015020000`, `docs/decisions/0030-fabrics-sizes-cut-list.md`.

**Depends on.** W0a. Uses W0 fixtures for pieces; never imports `lib/pattern-library`.

**Tests.** Unit on every helper; starter chart invariants (`lib/sizing/invariant.ts`) extended to
new labels; RLS; e2e: add a fabric test and see the print scale change.

### W3. Print zones and print files, per piece and per player (gaps 4, 6, 7 files)

**Goal.** Produce the files a sublimation house prints from: artwork on every pattern piece in
every size, at 1:1, with bleed, shrink scale, colour profile and clear space, and one set per
player.

**Build.**
- `lib/print/zones/`: zone templates per garment template, defined against landmarks so they
  follow every size: crest (left chest), sponsor (centre chest, max 30 x 7 cm in the jersey
  template), front number, back name, back number, sleeve badge, sleeve band. Clear space per
  zone.
- `lib/print/rules/`: minimum text height and line weight, colours to avoid (from the print
  profile), league rule sets (number height range, digits, contrast). Shipped empty except
  structure; every rule has a source.
- `lib/print/layout/`: place spec artwork, kit pattern and player marks on each piece:
  - repeat fill for kit patterns from one datum shared by all pieces (chest line at CF and CB)
    so rows meet across side seams and armholes; dot repeat at fixed scale in every size
    (benchmark rule), numbers graded only between junior and adult;
  - knock-out of the ground pattern inside each mark's clear space;
  - mirror-about-fold for pieces cut on the fold, so the file is the full opened piece.
- `lib/print/render/`: SVG (mm units), PDF (page = piece bounds plus bleed, at 1:1; spike the
  existing `@react-pdf/renderer` with a custom page size first, `pdfkit` as fallback per decision
  0008), TIFF through `sharp` at the profile's dpi (default 150, labelled default) with the ICC
  profile embedded when the brand has uploaded one. Every file: cut line, bleed line, piece
  name, size, player, scale applied, and a margin note for anything unmet.
- `lib/print/players.ts`: from a `TeamOrder` (W0 contract), one file set per player: the
  player's pieces with name and number swapped, plus a transfer-only set (name and number
  layers alone) when the technique is transfer. Checks: name fits the zone at the minimum
  height, number digits allowed by the league rules.
- Zip download route `app/api/projects/[projectId]/print-files/**`, built on download.
- UI: `components/production/print/**` with a zone overlay on the flat.

**Acceptance (beats the benchmark, which has no print files).**
- Polka-dot jersey, every size of the graded fixture (or W1's set once merged): one file per
  piece per size, each a 1:1 PDF whose page measures piece bounds plus 2 x 15 mm (read back with
  `pdfjs-dist`, within 0.1 mm), plus SVG and a 150 dpi TIFF of the right pixel size.
- Shrink 2.0 / 1.5 % from a fabric test scales the art and the cut line by 1.0204 x 1.0152; the
  file says so in its margin.
- Dot rows line up across the side seam within 0.5 mm at the chest line in every size; a dot
  column sits on CF and CB.
- No dot enters the 1.0 cm clear space around number, name or crest.
- 22-player sample roster: 22 back pieces with the right name and number, plus a manifest
  line per file; a 14-letter name that does not fit the back-name zone at the minimum height is
  reported, not squeezed.
- Same inputs twice give byte-identical files (hash test).

**Owns.** `apps/web/lib/print/**`, `apps/web/components/production/print/**`,
`apps/web/app/api/projects/[projectId]/print-files/**`, `apps/web/app/api/print-profiles/**`,
migration `20261015030000`, `docs/decisions/0031-print-files.md`.

**Depends on.** W0a (contract, fixtures), W0b (dots) for the jersey criteria. Reads W2's
`printScale` only through the W0 `FabricProfile` helper; reads pieces only through the W0
contract.

**Tests.** Geometry unit tests; PDF and TIFF read-back; determinism; property test that no mark
leaves its zone; e2e: download the jersey's print zip.

### W4. Team orders, frozen releases and strike-offs (gaps 7 roster, 10, 11)

**Goal.** Hold who gets what, freeze an accepted design with everything needed to print it again,
and record the strike-off and the people who signed.

**Build.**
- `lib/orders/**`: team order and roster rows (name, number, size label, cut, quantity); CSV
  import with column mapping (reuse `lib/sizing/csv.ts` read-only); checks: size in the run,
  duplicate numbers, empty names allowed only when the design has no name place; a manifest
  (size by cut totals, per-player list) as CSV and PDF. Player names are personal data: add them
  to the deletion flow (`lib/deletion/**`, W4 is the only workstream touching it) and to
  `docs/data-processing.md`.
- `lib/releases/**`: `production_releases`, append-only with the same trigger pattern as
  `spec_versions`. A release snapshots spec version, pattern block version, fabric and fabric
  test ids, print profile, roster hash and the SHA-256 of every print file. A reorder rebuilds
  from the snapshot and compares hashes; a mismatch is shown with its cause (for example "the
  print profile changed") and nothing is sent until someone chooses.
- `lib/proofs/**`: strike-off records: requested, received (photos, measured shrink length and
  width, colour notes per colour standard), accepted or rejected by a named person with role and
  date. Measured shrink can be saved as a fabric test through the W0 contract shape (W2's API
  route, no import of W2 code). Sign-off records (role, name, date, release id) for pattern,
  print, production and club.
- UI: `components/production/orders/**`, `components/production/release/**`.

**Acceptance.**
- 22-row roster imports, flags a duplicate number 10 and a size not in the run; manifest totals
  match the rows.
- A release for the jersey lists every file with a hash; a reorder from it rebuilds identical
  hashes; changing the fabric test after the release makes the reorder report the change.
- A release row cannot be updated or deleted (DB test), like `spec_versions`.
- Strike-off accepted by a named person shows on the release; a rejected one blocks the
  "ready" item for proofs.

**Owns.** `apps/web/lib/orders/**`, `apps/web/lib/releases/**`, `apps/web/lib/proofs/**`,
`apps/web/lib/deletion/**` (roster additions only), `apps/web/components/production/orders/**`,
`apps/web/components/production/release/**`, `apps/web/app/api/projects/[projectId]/orders/**`,
`.../releases/**`, `.../proofs/**`, migrations `20261015040000` and `20261015040100`,
`docs/data-processing.md`, `docs/decisions/0032-orders-releases-proofs.md`.

**Depends on.** W0a. File hashing calls W3 through an injected `PrintFileBuilder` interface from
the W0 contract, tested with a fake until W3 merges.

**Tests.** Unit, RLS and trigger tests, e2e: import roster, freeze, reorder.

### W5. Tech pack v2 and the definition of "ready for the factory" (gap 8)

**Goal.** A factory file that a sample room can cut, print and sew from without a single
"confirm".

**Phase A (parallel, against W0 contracts and fixtures).**
- New sections in `lib/techpack/`: `pattern-and-cutting` (pieces, cut list per size, seam
  allowance per seam, notches present), `fabric` (stretch, shrink, gsm, width with sources),
  `artwork-and-colour` (colour standards with role, factory code as typed and screen colour
  labelled "screen only"; repeat spec; zone table with clear space; per-size placement measured
  from HPS and CF), `operations` (ordered sequence from technique and seams, proposals flagged),
  `proof-and-sign-off` replacing the empty sign-off with named records.
- Measurement table: for each point and size, target (chart or brand), measured on the pattern,
  difference, inside tolerance or not.
- `lib/techpack/readiness.ts`, the definition of **ready for the factory**, all must hold:
  1. Pattern: every piece for every ordered size, from a block version with a technician review
     record; seam allowance stated on every edge; notches on every joined seam; joined seams
     agree within 2 mm or the stated ease; grain line on every piece.
  2. Spec: every applicable point at every ordered size has a target and a measured value
     inside tolerance; none to be confirmed.
  3. Fabric: stretch and shrink from a fabric test, and the block's reduction matches it.
  4. Print: files for every piece, size and player at 1:1 with bleed at least the profile's,
     scaled from the fabric test; no mark outside its zone or into clear space; every colour has
     a factory code; no colour on the profile's avoid list unless someone accepted it by name;
     text and lines at or above the minimums; league rules met when set.
  5. Proof: a strike-off accepted by a named person for this release.
  6. Order: roster valid.
  7. Release frozen with hashes.
  8. Components and construction: nothing left as a proposal or empty (today's completeness).
  Each unmet item is one sentence naming who acts. The word shown is "Ready for the factory";
  never "production-ready".
- PDF, Excel and SVG exports carry the new sections; wording test extended with the new
  allowed record sentences ("Reviewed by", "Accepted by", "Signed by" with a name).

**Phase B (after W1 to W4 merge).** Replace fixtures with the real services; e2e: the
polka-dot jersey from design to a factory file whose readiness list shows only owner-input
items.

**Acceptance (beats the benchmark).**
- Jersey, every size: every applicable point measured from the pattern, zero "confirm"; the
  four points where the benchmark's PDF and DXF disagree shown with their difference.
- Cut list per size with fabric use; the benchmark has "confirm from marker".
- Artwork and colour page lists C1 to C4 roles, repeat (3 cm dots, 7 cm pitch, 3.5 cm rows,
  half drop), every zone and its clear space, placements per size.
- The readiness list on the benchmark-equivalent jersey with no owner input lists exactly the
  owner-input items in section 7, each with who acts.

**Owns.** `apps/web/lib/techpack/**`, `apps/web/components/techpack/**` except
`PatternSection.tsx`, `apps/web/lib/projects/tech-pack-*.ts`,
`apps/web/app/(app)/studio/[projectId]/tech-pack/**`, `apps/web/app/api/projects/[projectId]/exports/**`,
`docs/decisions/0033-tech-pack-v2.md`, migration slot `20261015050000` if needed.

**Depends on.** W0a for phase A; W1 to W4 merged for phase B.

### W6. Spike: one coordinate system for 3D and pattern pieces (gap 5)

**Goal.** A design note, not a build. Today's 3D form is inflated from the flat outline
(`lib/garment3d/mesh.ts`) and knows nothing of pieces.

**Deliver** `docs/spikes/3d-pattern-coordinates.md` and `docs/decisions/0034-3d-pattern-coordinates.md`
(status "Proposed"): the UV approach (each 3D triangle carries piece id and piece mm
coordinates, so a mark placed in 3D maps to a piece point and from there to W3's layout), the
landmark correspondence it would use (W1's landmarks), what a draped form needs (blueprint layer
F), what can be reused now (W3 zones drawn on the 3D form by mapping zone landmarks to the
flat), cost and risk, and a recommendation with a trial of one week. A prototype under
`apps/web/scripts/spikes/**` is allowed only if under a day.

**Owns.** `docs/spikes/**`, `apps/web/scripts/spikes/**`, `docs/decisions/0034-*`. **Depends
on.** Nothing.

---

## 6. Shared files and who owns them

| Path | Owner | Others |
|---|---|---|
| `lib/production/contract/**`, `lib/production/fixtures/**` | W0 | After W0 merges, a change goes in a small PR labelled `contract`, reviewed by the lead, then the others rebase. Additive changes only. |
| `lib/garment/provenance.ts`, `lib/projects/provenance-tone.ts` | W0 | No one else. |
| `lib/garment/kit-pattern.ts`, `lib/flat/kit-pattern.ts`, `lib/intent/kit-pattern.ts`, `lib/kit-styles/presets.ts` | W0 (W0b) | Then W3 for print-only helpers in its own files. |
| `lib/techpack/artwork.ts` | W5 | W0b may add the one-line `dots` description. |
| `lib/server/limits.ts`, `lib/storage/store.ts`, `vitest.config.mts`, `lib/workspace/tools.ts`, `components/production/ProductionPanel.tsx` | W0 | Others ask. |
| `supabase/migrations/**` | Each workstream its own file only | `files_kind_check` and bucket types: W0 only. |
| `package.json`, `pnpm-lock.yaml`, `docs/launch/licences.md` | W0 | A new dependency is announced on the PR; the lockfile is regenerated on rebase. |
| `docs/decisions/README.md` | W0 reserves rows | Each workstream edits only its own row's status. |
| `lib/sizing/csv.ts` | W2 | W4 imports read-only. |
| `lib/patterns/access.ts` | W1 | W3 and W4 import read-only for the owner-only trial gate. |
| `lib/deletion/**` | W4 | |
| `components/techpack/PatternSection.tsx` | W1 | |
| `lib/garment/**` (everything else), `lib/flat/**` (else), `lib/garment3d/**` | nobody in this plan | Leave alone. |

---

## 7. Owner input, and how work proceeds without it

| ID | Needed from the owner | Until then |
|---|---|---|
| P1 | A technician to review each pattern block (blueprint layer R) | Every pattern and print file says "Draft pattern, not reviewed." Readiness item 1 open. |
| P2 | Patterns for products fashionINSTA cannot draft: football shorts, singlet, skort, hoodie, track jacket, raglan jersey, knit polo collar; the sock factory's knitting programme | Library slots exist and say "No pattern yet". |
| P3 | Australian size charts and junior labels, women's 3XL, and which pattern size each label is cut from (A5 extended) | Starter values and a suggested label map, shown as suggested. |
| P4 | Fabric tests per base fabric (stretch at load, recovery, sublimation shrink at the press settings) from the mill or print house | Values `not-set`; print scale 1.0 with a margin note; readiness item 3 open. |
| P5 | Print house profile: ICC file, dpi, maximum print width, bleed they want, colours that sublimate badly | Defaults 150 dpi and 15 mm bleed labelled "Knitwright default"; no ICC embedded; avoid list empty and said to be empty. |
| P6 | Pantone: whether Knitwright licenses a Pantone library | No Pantone data shipped. Factory codes are what a person types, screen colours labelled "screen only". |
| P7 | League or competition rules (number heights, digits, contrast, sleeve badges) for the clubs targeted | No rule set; the readiness list says "No league rules set: check with the competition." |
| P8 | Lettering fonts for names and numbers (already asked in decision 0027) | Files use the bundled font and say the lettering style in words. |
| P9 | Marker efficiency and usable fabric widths from the factory | Fabric use labelled with the default efficiency; replaced when a marker or the factory gives one. |
| P10 | Who signs: names and roles for pattern, print, production and club sign-off | Sign-off records accept any member with a typed role. |
| P11 | Whether the Platform and Store Guide supersedes the 2026-09-27 decisions (AUD, Australia) | Plan works for both; Australian sizes are added, not replacing others. |

---

## 8. Order and parallelism

```
W0a ──┬── W1 pattern library ─────────┐
      ├── W2 sizes, fabrics, cut list ─┤
      ├── W3 print files (needs W0b) ──┼── W5 phase B (integration) ── done
      ├── W4 orders, releases, proofs ─┤
      ├── W5 phase A ──────────────────┘
      └── W6 spike (independent, may start before W0a)
W0b ── (after W0a, before W3's jersey criteria)
```

Merge order after W0: any order among W1 to W4 and W6 (no cross foreign keys, no shared
files); W5 phase B last. Each PR runs the standard gate. Expected overlap: none outside section 6.

## 9. Top ways the result beats fashionINSTA

1. Every point measured from the pattern at every size, with target, measured value and
   difference; the benchmark leaves six as "confirm" and contradicts its own DXF on four.
2. A graded set across the Australian run, with each label mapped to its pattern size; the
   benchmark drafts one size.
3. Print files per piece per size at 1:1 with 15 mm bleed, scaled from a tested shrink, with
   repeats matched across seams and clear space kept; the benchmark has none.
4. Per-player print and transfer sets from a checked roster and a manifest; the benchmark has
   none.
5. DXFs with real notches, grain lines and stated seam allowance, a cut list with fabric use,
   and a frozen release with file hashes and a named strike-off, so a reorder prints the same;
   the benchmark's DXF has no notches and says nothing about allowance.

## Mutation log

| Date | Change | Reason |
|---|---|---|
| 2026-10-14 | Created | Owner asked to cover the gaps and beat the fashionINSTA benchmark |
