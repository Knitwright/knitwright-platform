# 0070: The production package (KPP) and the files-service seam

Status: Proposed. Nothing calls either yet: the assembler has no route and the files service does not exist.
Date: 2026-10-29
Plan step: `plans/platform-v5.md`, wave 1, workstream X5. Spec: `docs/spec/04-production-package.md`, F-S6 and F-G2 of
`docs/spec/02-features.md`. Builds on 0011 (exports), 0031 (print files), 0037 (pattern generators), 0044 and 0051 (credits).

## Context

`docs/spec/04-production-package.md` says what a factory needs to make a design version without asking a question: one ZIP
per design version × factory, laid out to the letter, every file generated, nothing hand-edited, and regenerating from the
same version hash giving byte-identical files. Two things had to be settled.

First, the package has twenty-odd files across eleven folders, built from six generators the platform already has and
several it did not. Second, `docs/spec/04` and `docs/spec/05-architecture.md` put the whole pipeline on a Python files
service on Modal. Owner decision 2 of plan v5 says that service is not wired in: it becomes the Sportswear model once the
model is final, and `Sportswear/` is never touched here. So the platform had to define the seam without crossing it.

## Decision

### 1. The assembler is TypeScript and in memory

`lib/kpp/assemble.ts` takes one plain, already-resolved `KppInput` (one design version, one factory, and for a batch its
orders) and a `KppSources` of the generators, and returns the ZIP bytes and the manifest. It reads no database, no
environment and no clock. Everything a factory sees is in the input, so the package cannot disagree with the screen that
showed it, and a test can build the whole thing.

Deterministic file generation stays in TypeScript, as owner decision 2 requires: DXF through the pattern library's writer
(`lib/pattern-library/dxf/write.ts`), and the 1:1 PDF, the SVG, every CSV, every JSON and every one of the package's own
PDFs through `lib/kpp`. The ZIP is `fflate` (MIT), already a dependency.

### 2. What the ZIP holds

Every path of `docs/spec/04`'s layout, with these notes:

| Path | Where it comes from |
|---|---|
| `manifest.json` | `lib/kpp`: every file with its sha256 and the generator that made it, plus the design hash and `KPP_GENERATOR_VERSION` |
| `00_README.pdf` | `lib/kpp`: what is inside by folder, the contact, the due date, and the sentences a factory must read first |
| `01_techpack/techpack.pdf` | The existing generator (decision 0011), through `TechPackPdfSource`; `lib/kpp/sources/techpack.ts` is the adapter |
| `01_techpack/techpack.json` | `lib/kpp`: the same sections with provenance and a rule id on every row |
| `02_measurements/pom.csv` | `lib/kpp`, with the spec's header exactly |
| `02_measurements/size_chart_customer.pdf` | `lib/kpp` |
| `03_patterns/dxf_aama/*.dxf` + `_nest.dxf` | `lib/pattern-library/dxf/write.ts`, per size and all sizes stacked |
| `03_patterns/pdf_1to1/*.pdf` | `lib/kpp`: 1:1, tiled onto A0 pages, alignment crosses at every tile corner, a 100 mm scale bar on every tile |
| `03_patterns/svg/*.svg` | `lib/kpp`: one canvas in mm, cut, sew, internal, fold, grain and notch each in its own class |
| `04_print/...` | The existing print builder (decision 0031), through `PrintSource` |
| `05_colour/colour_spec.{pdf,json}` | `lib/kpp` |
| `06_bom/bom.csv` | `lib/kpp`, with the spec's header exactly |
| `07_labels/care_label_<market>.pdf` | `lib/kpp`: one 60 × 100 mm label per destination market |
| `07_labels/brand_label.pdf` | The brand's upload, when there is one |
| `08_personalisation/names_numbers.csv` | `lib/kpp`, batch packages only |
| `09_qc/qc_checklist.pdf` | `lib/kpp` |
| `10_reference/renders_front_back.pdf` | `lib/kpp`, from a `RenderSource`. There is no server renderer yet, so the page says so in words and carries "Render, not photo" either way |
| `10_reference/golden_sample.pdf` | The approved sample's report, when there is one |
| `job_sheet.pdf` | `lib/kpp`, batch packages only, at the root; batch print files group by order |

### 3. Determinism

The same input and sources give byte-identical bytes, proved by building twice and comparing the sha256 of the ZIP
(`assemble.test.ts`). It holds because:

- no generator in `lib/kpp` reads the clock: the PDF writer takes the creation date as an argument, and that is always the
  design version's creation time;
- the PDF writer's file id is a hash of the file's own content, not a random number;
- a PDF from another generator is pinned by `pdf/pin.ts`, which rewrites `/CreationDate`, `/ModDate` and `/ID` in place
  (@react-pdf/renderer writes the clock into all three). Each replacement keeps the length of what it replaced, so the
  cross-reference offsets stay right;
- files are zipped in path order with an mtime of the version's creation time, never the clock;
- every JSON is written with sorted keys, and every CSV's row order is a total order over all its columns.

### 4. The F-G2 gate

`lib/kpp/gate.ts` refuses to build while any of F-G2's items holds, and the refusal lists every one with a dotted path, a
sentence and a rule id: a field whose provenance is `needs_input` or whose value is blank; `[TBC]` in any string anywhere
in the input, at any depth and in any letter case; no POMs, a POM with no value for a size in the run, or a POM with no
tolerance; no BOM, no fabric line, or a line missing its specification, quantity or unit; a colour spec with no fabric, no
roles, or a role missing a valid hex, a Pantone TCX or a swatch ID; no destination market, or a label missing fibre, care,
origin, size or (where the market needs one) the importer; print files below the rules' DPI or bleed; a batch with no
orders or an order for a size outside the run; a moderation status of `flagged` or `pending`.

Two of F-G2's items are deliberately not blockers:

- **Gamut.** `lib/guardrails/gamut` is explicit that it is an estimate made with no print house's ICC profile and is
  "never a blocker". Blocking a package on a guess would be worse than shipping one with a warning, so a saturated colour
  becomes a sentence in `00_README.pdf` through `packageWarnings`, telling the factory to match the strike-off.
- **Moderation.** F-G1 does not exist yet (X8 builds it in this wave). A status of `not_built` lets the package through
  and adds a README line saying no check was made. Once X8 is merged this becomes a blocker like the others.

### 5. Patterns come through an interface

X3 builds the graded drafter in parallel, so `PatternSource` is the smallest interface that gives a `GradedPattern`
(plan v5, Lessons 9). The test double in `lib/kpp/fixtures` is the pattern library's synthetic seven-size run with a sew
line and notches added, both clearly labelled as not real. Wave 2 points it at `lib/parametric`. The same holds for
`PrintSource`, `TechPackPdfSource` and `RenderSource`.

### 6. The files-service seam

`lib/files-service` is the contract for the future Python service, and nothing calls it. `filesServiceFrom(env)` returns
the HTTP client only when **both** `FILES_SERVICE_URL` and `FILES_SERVICE_TOKEN` are set; otherwise, and so everywhere
today including CI, it returns a stub that answers `{ ok: false, failure: "not_available" }` for the health check and for
every operation, with a sentence naming what that operation will do.

One method, `call(operation, request)`, covers every endpoint, so a new operation is a type change rather than a new
interface and the stub cannot drift from the client. Answers are parsed with zod: a shape this version does not know is a
`bad_answer` failure, never a value that reaches a factory file. Failures are told apart as `not_available`, `refused`,
`unreachable`, `bad_answer`, `timed_out` and `service_error`.

**Authentication.** The files service trusts the platform, not a person, so the call carries a service token, not a
session: HMAC-SHA256 over `v1.<operation>.<expiry>.<hash of the body>` in `x-knitwright-service-token`, good for 120
seconds. Binding the operation and the body means a token caught in a log cannot be replayed as a different, more
expensive call. `verifyServiceToken` checks it the way the service will, so the format is tested from this side.

**Metering.** `meteredFilesService` reserves the estimated cost through `lib/usage` before any paid operation and gives it
back when the call fails, the same shape the image provider uses. A refused reservation never reaches the service, so a
cap stops a paid call before it starts (decision 0012). The estimates in `ESTIMATED_COST` are placeholders: no provider
has been chosen for any of them.

**The operations, the engines and the licences.** Taken from the Sportswear capability list; `Sportswear/` itself is never
read or built here.

| Operation | Paid | Sportswear engine | Licence note |
|---|---|---|---|
| `draft_pattern` | no | Parametric drafter, body measurements to panels | Knitwright's own code |
| `read_dxf` | no | DXF reader (`ezdxf` with the AAMA/ASTM add-on) | ezdxf is MIT |
| `nest_marker` | no | Nesting and marker maker: grain constrained, fabric width, shrinkage warp and weft, one-way nap, per-kg and per-metre costing | Knitwright's own code |
| `fit_check` | no | Avatar fit check | Knitwright's own code |
| `render_garment` | yes | Ghost-mannequin and on-model renderer | **Not klein-9b**: its weights are under a non-commercial waiver and must not be used commercially. A commercial-licence provider has to be chosen first |
| `transfer_design` | yes | Design and fabric texture transfer onto a render | **Not SegFormer**: it must not be used commercially. Any segmentation step needs a commercially licensed model |
| `composite_logo` | yes | Logo compositor | Not SegFormer, for the same reason |
| `detect_brand_marks` | yes | Brand-mark and trademark-text detector (F-G1) | Vision model still to be chosen; commercial-licence tier only |

Spec decision 13 holds across the seam: `render_garment` renders locked geometry rather than drawing a garment, and
`transfer_design` and `composite_logo` answer with `appliesToPanels: false` in the type itself, so nothing they return can
be mistaken for something a panel layer or a print file may hold.

### 7. The export, the charge and the record

`lib/kpp/export.ts` decides the charge, charges, then builds, in that order, as decision 0051 requires. The package is
free when Knitwright makes the order and free for a production batch (spec decision 9); otherwise it is charged. The
charge goes through a `ChargeForPackage` interface with a stand-in that charges nothing, **not** through `withCredits`:
the `production_package` output kind does not exist yet, and adding it means editing `lib/credits/kinds.ts`,
`lib/credits/settings.ts` and the seeded `credit_prices` of an already-shipped migration, none of which X5 owns. See
"What is owed".

`PackageRecord` is what a `package_exports` row would hold: the root, the file name, the design and its hash, the factory,
the generator version, the ZIP's own sha256, its size and the file count.

### 8. No migration

The plan reserved `20261101040000_package_exports.sql` "only if needed". It was not needed: with no export route there is
nothing to store, and an unused table with its own row-level security and isolation entries would have to be written
without a database to test it against. `PackageRecord` is the shape the table takes when wave 2 adds the route.

## Evidence

| Claim | Test |
|---|---|
| The ZIP holds every path `docs/spec/04` lists for a sample package, and nothing else, all under the package root | `lib/kpp/assemble.test.ts` |
| A batch adds `job_sheet.pdf` and `names_numbers.csv` and groups print files by order and then size | `lib/kpp/assemble.test.ts` |
| Building twice gives a byte-identical ZIP, although the tech pack generator reads the clock | `lib/kpp/assemble.test.ts` |
| Every PDF in the package carries the version's creation time as its creation and modification date | `lib/kpp/assemble.test.ts` |
| The manifest lists every other file with its sha256, size and generator | `lib/kpp/assemble.test.ts` |
| One article in seven sizes builds in well under 60 seconds (it takes about a fifth of a second) | `lib/kpp/assemble.test.ts` |
| Every F-G2 item refuses with a sentence and a rule id, and the list is the same twice | `lib/kpp/gate.test.ts` |
| A saturated colour and a missing moderation check warn without stopping the package | `lib/kpp/gate.test.ts` |
| `pom.csv` and `bom.csv` have the spec's headers exactly, and a size with no value is left empty | `lib/kpp/files/files.test.ts` |
| `techpack.json` carries a rule id and a provenance on every row | `lib/kpp/files/files.test.ts` |
| The 1:1 PDF is on A0, tiled, with alignment crosses, a 100 mm scale bar and "print at 100%" on every tile | `lib/kpp/files/files.test.ts`, `lib/kpp/edges.test.ts` |
| A name a spreadsheet would read as a formula is written as text in every CSV | `lib/kpp/encode.test.ts`, `assemble.test.ts` |
| No design name a person types can make a path that leaves the package folder | `lib/kpp/encode.test.ts` |
| The files service answers "not available" for every operation while its address is unset, which it is everywhere | `lib/files-service/files-service.test.ts` |
| An address with no secret gives the stub, not a call to an unauthenticated service | `lib/files-service/files-service.test.ts` |
| A service token cannot be replayed as another operation, over another body, or past its expiry | `lib/files-service/files-service.test.ts` |
| An answer in a shape this version does not know is a failure, not a value | `lib/files-service/files-service.test.ts` |
| A paid operation is reserved before the call, refunded when it fails, and never called when the allowance is used up | `lib/files-service/files-service.test.ts` |
| The charge is made before any file is built, and a refusal builds nothing | `lib/kpp/export.test.ts` |
| Every engine note keeps klein-9b and SegFormer out | `lib/files-service/files-service.test.ts` |

No test reaches the network: `fetch` is passed into the client. No test makes a paid call: there is nothing to call.

Not verified: there is no Docker on the machine this was written on, so no database test, no `pnpm build` and no
end-to-end spec ran here; CI is their first run. No factory has opened any of these files, and the Phase 0 test matrix of
`docs/spec/04` (opening the DXF in Seamly2D, Valentina, Inkscape and a commercial CAD) has not been run by anyone.

## Alternatives

- **Build the package on the Python service now**, as `docs/spec/04` draws it. Refused by owner decision 2: the Sportswear
  model is not final, and the deterministic writers already exist in TypeScript and are tested.
- **One method per operation on the `FilesService` interface** instead of one `call`. Clearer at each call site, but the
  stub and the client then have eight bodies each to keep in step, and adding an operation touches four files. Rejected.
- **A session token, or no token, on the files-service call.** A session is the wrong subject: the service acts for the
  platform, not for a person, and often with no person present (a batch built at cut-off). No token at all would leave an
  endpoint that spends money open to anyone who learns the address. Rejected both.
- **Block the package on the gamut estimate**, so F-G2's list is honoured literally. It would refuse packages over a
  number `lib/guardrails/gamut` says itself may be wrong in either direction. Rejected; it warns instead.
- **A `package_exports` table now.** See point 8.
- **Writing the 1:1 PDF with @react-pdf/renderer**, the repo's existing PDF library. It writes the clock into every file,
  draws in points rather than millimetres, and has no tiling or clipping. The package's own writer is about 180 lines, has
  no clock and no random id, and draws in millimetres, which a 1:1 pattern needs. Kept; the tech pack PDF still comes from
  @react-pdf/renderer, pinned afterwards.
- **A native CorelDRAW `.cdr` writer**, which is what the Sialkot floor uses. `docs/spec/04` already rejects it: there is
  no reliable open writer. The 1:1 PDF and the SVG both open in CorelDRAW, and the Phase 0 test records which the factory
  actually used.

## What is owed

- **The export route.** The plan's item 6 asks for one behind the credits gate. X5 owns no route path, and the
  `production_package` credit kind needs `lib/credits/kinds.ts`, `lib/credits/settings.ts` and a new migration to reseed
  `credit_prices`, none of which X5 owns. `lib/kpp/export.ts` is route-shaped and `ChargeForPackage` is the one seam to
  fill. Wave 2 adds the kind, the route and the `package_exports` table together.
- **A real `KppInput` builder.** Nothing builds one from a design version yet: the POMs, parameters and construction come
  from X1's catalogue, the validated design and its provenance from X4, and the factory, fabric, label rules and price
  from X6. Until those merge, the only `KppInput` is the test fixture.
- **The graded pattern.** `PatternSource` is fed by the pattern library's synthetic run, which is not a real grade. X3's
  drafter replaces it in wave 2, and the `_nest.dxf` becomes a real graded nest rather than the sizes stacked.
- **Renders.** `10_reference/renders_front_back.pdf` says "no render is available" in every package, because there is no
  server renderer. It is `render_garment` on the files service, so it waits for that.
- **ICC colour.** `docs/spec/04` asks for the factory's measured ICC profile at export when one exists. None exists, so
  print files stay sRGB and the README says so. The Lab in `colour_spec.json` is computed from the screen colour, not
  measured, and the file says so.
- **Translate.** F-S6 asks for the tech pack PDF in Urdu as well as English (Phase 3). Not started; the package's PDF
  writer uses the standard fonts, which have no Urdu, so this needs an embedded font.
- **The Phase 0 factory test**, all five points of `docs/spec/04`.

## Owner questions

1. **Which white point does the colour house work to?** `colour_spec.json`'s Lab for `#0B1F4B` comes out as
   `[13, 10.7, -29.6]` (sRGB, D65, two-degree observer, the same maths as `lib/print/rules/colour`). The spec's own
   example shows `[12.9, 4.1, -27.6]`, which is not that; the spec calls its numbers illustrative. Which one the strike-off
   is read against changes nothing we generate, but it changes what a ΔE of 1.5 means.
2. **Is a sample package for a factory Knitwright does not own free?** Today it is charged, because the brand is taking the
   files elsewhere. A sample at a partner factory arguably is not.
3. **Does `04_print/<size>/` keep the `SAMPLE_` prefix?** `docs/spec/04`'s folder tree shows
   `<article>_<panel>_<size>.pdf`, and its naming paragraph shows `<orderNo|SAMPLE>_<article>_<panel>_<size>.pdf`. The
   naming paragraph was followed, so a sample file is `SAMPLE_JSY-SS-01_back_XL.pdf`.
4. **Which notch does the DXF carry?** The factory profile's choice of V-notch or slit is in the README and on the 1:1
   PDF, but the pattern library's DXF writer marks a notch one way only (layer 4). Does the factory need the DXF itself to
   differ, or is the stated style enough?
5. **The default tolerances** of `docs/spec/04` (±10 mm on body widths and lengths, ±5 mm on sleeve, inseam, neck and
   waistband heights, ±3 mm on compression) are placeholders to confirm in Phase 0. The gate refuses a POM with no
   tolerance rather than filling one in.
6. **AQL for a Class A sample.** `09_qc` asks for 100% inspection on Class A and an AQL plan for runs. A sample Knitwright
   makes says "inspect every piece"; a sample at a partner factory uses the plan in the input.

## Consequences

- There is a package assembler and a files-service seam, and nothing calls either. That is deliberate: both are the thing
  wave 2 wires up, and both are fully tested from the inside.
- `lib/kpp` carries its own small PDF writer (about 180 lines) beside `@react-pdf/renderer`. Two PDF writers in one
  repository is a cost. It is paid for by a 1:1 pattern PDF that is actually 1:1, has no clock in it, and can be tiled;
  and the tech pack, which is the one document a person reads for pleasure, still comes from the typeset renderer.
- The package's own PDFs use Helvetica and Helvetica-Bold, which every reader carries, so nothing is embedded and a file
  is small. A character outside Latin-1 becomes a question mark, and a few symbols (Δ, ≤, dashes, quotes) are written as
  plain text. An Urdu or Chinese design name is therefore not readable in these files; it is readable in the tech pack PDF.
- `pdf/pin.ts` rewrites bytes inside a PDF another library made. It is careful — every replacement keeps its length, and a
  PDF with neither a date nor an id comes back unchanged — but it is coupled to how @react-pdf/renderer writes its
  information dictionary. If that changes, the determinism test fails rather than the package quietly differing.
- The `lib/kpp` tests make a PDF for every size and read several back, so they join the `pdf` vitest project and run after
  the rest, one file at a time (the lesson of decision 0011).
- Two new coverage entries at 90%: `lib/kpp/**` and `lib/files-service/**`.
- No new dependency. `fflate` (MIT) and `zod` (MIT) were already here.

---

# 0070 revision 1: the pattern source is wired (wave 2 prerequisite)

Status: Proposed. Date: 2026-10-30. Plan step: `plans/platform-v5.md`, the opening paragraph of "# Wave 2". No
migration.

Point 5 above fed `PatternSource` with the pattern library's synthetic run, which is not a real grade.
`apps/web/lib/kpp/sources/pattern.ts` now draws it from the graded parametric drafter (X3, decision 0068, as
X3b revised it):

- `draftedPattern(code, input?, sources?)` calls the drafter's public API only — `draftAllSizes` and
  `toGradedPattern` — and answers either a `GradedPattern` of every size the article grades, with the
  article's own version string and the drafter's warnings beside it, or the drafter's reason for having none.
  Nothing reaches into the drafter's internals, and the drafter reads its numbers through its own data source,
  so a factory's `draft_constants` reach the package without this file changing.
- **No invented geometry.** An article with no drafting script (every launch article but `JSY-SS-01`), no
  article data, no drafting constants, or an option whose shape the article does not define (C02 and C03, which
  owner decision 8 leaves "not drafted yet") comes back as `ok: false` with the drafter's sentence. The caller
  reports it; nothing is drawn.
- `DRAFTED_BLOCK_VERSION` is 1: `GradedPattern.blockVersion` wants a whole number and counts changes to what
  the drafter produces, which is not the article's own `version` ("0.1"). Both numbers travel with the answer,
  and the files name both.
- The fixture's synthetic run stays as the test double in `lib/kpp/fixtures`, labelled as before.

Still owed, unchanged by this PR: the export route, a real `KppInput` built from a design version, and the
`_nest.dxf` being a real nested marker rather than the sizes stacked.

## Evidence

| Claim | Test |
|---|---|
| Every size of `JSY-SS-01` comes back as a `GradedPattern` the production contract accepts | `lib/kpp/sources/pattern.test.ts` |
| The same article and input give the same pattern twice | `lib/kpp/sources/pattern.test.ts` |
| An article with no script, and an option with no shape, answer with the reason in words | `lib/kpp/sources/pattern.test.ts` |

---

# 0070 revision 2: the real input, the charge, the record, and owner decisions 15 to 19

Status: Proposed. Date: 2026-10-30. Plan step: `plans/platform-v5.md`, wave 1, workstream **X5b**
("Production package follow-up, from owner decisions 15 to 20"). Migration
`supabase/migrations/20261101040000_package_exports.sql`.

X5 built the assembler and the files-service seam with nothing to feed either: "What is owed" above lists a real
`KppInput` builder, the export route, the `production_package` credit kind and the `package_exports` table. X1's
catalogue (0066), X4's design object and provenance (0069) and X6's factory, fabric and price rows (0071) have now
merged, so this revision fills them in and writes down the five owner decisions X5 could only ask about.

## 1. The real `KppInput` builder

`apps/web/lib/kpp/input/**` turns the rows the platform stores into one `KppInput`. It is pure: no database, no
environment, no clock, so a test builds the whole thing. `KppRows` names every row it reads:

| Part of the package | Rows it comes from |
|---|---|
| Sizes, base size, article code, class, fit, HS code, origin | X1 `base_articles` |
| `02_measurements/pom.csv`, the size chart, the QC tolerances | X1 `article_poms` |
| One overview field per option group and per parameter | X1 `option_defs`, `parameter_defs` |
| BOM specifications, thread, seam allowances | X1 `article_fabrics` and the article's thread; X6 `programme_fabrics` |
| Colour roles, hex, Pantone | X4 `toDesignObjectV2`'s colourway |
| Fabric, swatch reference, colour difference | X6 `programme_fabrics`, `programme_fabric_colours`, `factory_capabilities` |
| Factory name, city, contact, accepted file formats | X6 `factories`, `factory_capabilities` |
| Destination markets and their label rules | X6 `country_rules` |
| Print DPI and bleed | `lib/guardrails` settings, which a print house overrides in `lib/settings` |
| Moderation status | X8 (0073), through X4's moderation port |

**Nothing is guessed.** A value no row holds becomes `needs_input`, and the F-G2 gate refuses the package and names
it. Three things follow from that and are worth stating:

- **No table holds the bill-of-materials consumption, the care-label wording or the AQL plan.** The worked
  article's own figures live in `docs/spec/articles/JSY-SS-01/article.json`, which X1 did not seed (its section
  lists six tables and none of them is a BOM), and X6 seeded `country_rules.label_rules` as `{}` with a note saying
  the wording is still to be written. So `KppUnsourced` carries them as labelled data, the platform has nothing to
  fill it from today, and every such line comes out `needs_input`. The tests supply the worked article's own
  placeholders, quoted, and `lib/kpp/input/package.test.ts` checks each one still matches that file, so the whole
  package builds for one article in seven sizes without anything being invented here.
- **The registry's option keys are not catalogue codes.** The design object holds `collar: "none"`; the catalogue
  holds `C01`, `K01`, `P00`. Nothing maps the two — X1's registry map joins articles to garment types, not options
  to options — so a choice that is not one of the article's codes is written as the design's own word with
  `R-GAP-000` and the sentence "not yet mapped to a catalogue code". It is never replaced by the article's default,
  which would put a collar on a design that asked for none.
- **One swatch reference per fabric, not per colour.** `docs/spec/04`'s example shows a per-colour swatch id
  (`SB-POLY-INT-031`); our programme keeps `programme_fabrics.swatch_ref`. The package carries that reference for a
  colour the fabric's programme actually holds and nothing for a colour it does not.

## 2. Owner decision 15: our colour numbers are D65, two degree, and the package says so

Kept exactly as the owner settled it. `05_colour/colour_spec.json` now carries a `lab_space` line —
"sRGB, D65 white point, two-degree observer. Computed from the screen colour, not measured." — and
`colour_spec.pdf` and the QC checklist say the same, so the colour house knows what the numbers are in.

`docs/spec/04` shows `#0B1F4B` as Lab [12.9, 4.1, -27.6]. The same maths as `lib/print/rules/colour` gives
[13, 10.7, -29.6], and a b\* differing by 6.6 is not a rounding difference. **The spec's example is recorded here as
unverified** and our figure is kept, because ours is the one the platform can reproduce and test. Our numbers were
not changed to match the spec.

Until the colour house states its white point, delta E <= 1.5 is defined against ours. One consequence: the package
never states a colour difference nobody agreed. `KppColourSpec.tolerance.max` is now nullable, it comes from
`factory_capabilities.colour_delta_max`, and the gate refuses when it is null — the same rule as decision 18's
tolerance, for the same reason.

**Owner action, still open: ask the colour house which white point and observer they work to, and whether that
example was measured or computed.** It changes nothing the platform generates; it changes what a delta E of 1.5
means.

## 3. Owner decision 16: a sample print file keeps its `SAMPLE_` prefix

Confirmed as built. `lib/kpp/paths.ts` writes `04_print/<size>/SAMPLE_<article>_<panel>_<size>.<ext>` for a sample
and `04_print/<orderNo>/<size>/<orderNo>_<article>_<panel>_<size>.<ext>` for a batch. `docs/spec/04`'s folder tree
and its naming paragraph disagree; the naming paragraph wins, because a factory must never be able to mistake a
sample file for a production one, and the cost of the stricter reading is only a longer filename.

## 4. Owner decision 17: one notch style in the DXF for now

Confirmed as built. The DXF marks every notch one way (layer 4), and the style is stated in words in
`00_README.pdf` and on every tile of the 1:1 PDF. No factory row holds a notch preference, so the builder adds a
README line saying so: notch style is a cutter-room setting the factory's own CAM applies. Revisit if a factory
asks for it in the geometry.

## 5. Owner decision 18: the gate keeps refusing a POM with no tolerance

Unchanged, and now tested against real rows. `lib/kpp/input/measurements.ts` carries each POM's tolerance through
exactly as `article_poms` holds it and gives none to a POM that has none; `lib/kpp/gate.ts` refuses with
"POM A ...: no tolerance.", and `lib/kpp/input/package.test.ts` proves the whole package refuses to build.

`article_poms` keeps a tolerance on every row, so a POM read from the catalogue always has both halves. Those
figures are the build pack's draft, seeded under the article's "Knitwright draft v0.1, not reviewed by a factory"
label, and they are carried with that label into `00_README.pdf` — never presented as agreed. **The spec's
+/-10/5/3 mm paragraph is not adopted as a default for anything the rows do not state**: a missing tolerance stays a
question for the factory.

## 6. Owner decision 19: AQL as built

`samplingPlan` in `lib/kpp/input/quality.ts`:

- a Class A **sample that Knitwright makes** says "Inspect every piece: this is a Class A sample and the brand's
  approval rests on it", whoever sews it;
- any other package uses the AQL plan on the input, which is the factory's own;
- with no plan on the input the checklist says "No AQL plan is on file for this factory. Agree one before a run;
  this package is not a run" — it never names a level nobody agreed, so `docs/spec/04`'s "level II, AQL 0 critical /
  2.5 major / 4.0 minor" is not assumed on a factory's behalf.

## 7. Owner decision 20: the charge, and the credit kind

**This one is money, and the owner may overturn it.** It is recorded here rather than settled quietly.

`production_package` is now a credit kind (`lib/credits/kinds.ts`), its price is in `lib/credits/settings.ts`, and
the migration reseeds `credit_prices` from it. **The price is a labelled placeholder, not a quoted price**: the row
is seeded with `is_placeholder = true`, `CREDIT_SETTINGS.isPlaceholder` is still true, and the gate's own refusal
ends "The price is a placeholder the owner has not set yet." Nobody is shown a settled figure, and the owner may
overturn both the number and the decision to charge at all.

Who pays, per owner decision 20 and spec decision 9: a sample package for a factory Knitwright does not own is
charged; it is free when Knitwright makes the order and free for a production batch, which is Knitwright's own run
rather than files a brand takes away. `chargeDecision` and `packageCreditKind` in `lib/kpp/export.ts` decide it, and
`lib/kpp/charge.ts` charges through the credits gate once per design version, so a failed download is safe to retry.

One change of order from X5: **`exportPackage` runs the F-G2 check before the charge.** A brand should not pay to be
told what the factory still has to answer. The charge still comes before any file is made, as decision 0051
requires; `buildPackage` checks again, which is cheap and deterministic.

## 8. The `package_exports` table

`supabase/migrations/20261101040000_package_exports.sql`. The plan reserved this timestamp "only if needed", and X5
did not need it because there was nothing to store. There is now: a charged export has to leave a record.

The package itself is still never stored — the ZIP is sent and thrown away — so the row is the evidence of what was
sent: the design, its version and hash, the factory code, the package root and file name, the generator version,
the ZIP's own SHA-256, its size, its file count, and the version's creation time every file is pinned to. Because
the same version and factory always give the same bytes, a stored hash is how a factory's copy is checked against
ours.

It follows `export_downloads` (20260929030000) exactly: no browser writes, `record_package_export` is the only way a
row is written and only the server's own key may run it, the brand is taken from the design rather than the caller,
members read their own brand's rows through row-level security, and an append-only trigger refuses any update,
delete or truncate except the delete that follows from deleting the design. `lib/kpp/record.ts` calls it and throws
when it cannot record, and then the ZIP is not sent: a package a factory holds that the platform has no record of is
a package nobody can check.

The migration also replaces the two check constraints of the credits migration (`credit_prices.output_kind` and
`credit_ledger.output_kind`) so they admit `production_package`, which is this repository's established idiom for
widening a check.

## 9. `FILES_SERVICE_URL` and `FILES_SERVICE_TOKEN`

Both are now declared in `apps/web/lib/config/env.ts` and listed, commented out, in `apps/web/.env.example`. Both
are **optional**, and both are unset in every environment today, including CI. `filesServiceFrom` therefore still
returns the stub, which answers `{ ok: false, failure: "not_available" }` for the health check and for every
operation — owner decision 2: the Sportswear model is not wired in, and nothing here calls it. An address with no
secret is a misconfiguration, not a reason to call an unauthenticated service, so that gives the stub too. The URL
must parse as a URL and the token must be at least 32 characters, so a typo stops the server at start-up rather
than inside a request. `lib/files-service/server.ts` is the one place that reads the environment.

## Evidence

| Claim | Test |
|---|---|
| The size run, base size, class, fit and HS code come from the catalogue row, not the design | `lib/kpp/input/build.test.ts` |
| Every overview field carries a rule id and a provenance, and none is `confirmed` | `lib/kpp/input/build.test.ts` |
| A design's option that is not a catalogue code is written as the design's own word, never as the article's default | `lib/kpp/input/build.test.ts` |
| Every POM comes through with the catalogue's grade, tolerance and value per size | `lib/kpp/input/build.test.ts` |
| A POM with no tolerance is given none, and the gate refuses (decision 18) | `lib/kpp/input/build.test.ts`, `lib/kpp/input/package.test.ts` |
| A BOM line with no consumption on file is left empty and the gate refuses | `lib/kpp/input/build.test.ts` |
| A colour difference no factory agreed makes the gate refuse, rather than the package stating one (decision 15) | `lib/kpp/input/build.test.ts` |
| The swatch reference is carried only for a colour the fabric's programme holds | `lib/kpp/input/build.test.ts` |
| A care label falls back to the fabric's blend for fibre and to nothing else | `lib/kpp/input/build.test.ts` |
| A Knitwright-made Class A sample inspects every piece; anyone else's uses the plan; no plan says so in words (decision 19) | `lib/kpp/input/build.test.ts` |
| `colour_spec.json` states the space and the observer of its Lab numbers (decision 15) | `lib/kpp/input/build.test.ts` |
| One article in seven sizes builds from real catalogue rows, with every path `docs/spec/04` lists | `lib/kpp/input/package.test.ts` |
| Building twice from the same rows gives byte-identical bytes | `lib/kpp/input/package.test.ts` |
| The fixture's quoted consumption, label wording and AQL plan still match `article.json` | `lib/kpp/input/package.test.ts` |
| `production_package` is a credit kind with a label and a placeholder price | `lib/kpp/charge.test.ts` |
| A brand's own export is charged; Knitwright's order and a batch are free | `lib/kpp/charge.test.ts`, `lib/kpp/export.test.ts` |
| A package the gate would refuse is never charged for | `lib/kpp/charge.test.ts` |
| The gate's refusal reaches the caller in its own words and nothing is built | `lib/kpp/charge.test.ts` |
| `record_package_export` is called with every column the migration takes | `lib/kpp/record.test.ts` |
| The seeded `credit_prices` row matches `lib/credits/settings.ts` and is a placeholder | `lib/credits/settings-seed.test.ts`, `tests/integration/package-exports.test.ts` |
| `package_exports` is append-only, server-written, and read only by the brand's own members | `tests/integration/package-exports.test.ts`, `tests/integration/isolation.test.ts` |
| `production_package` can be spent on the ledger, which the old check constraint would have refused | `tests/integration/package-exports.test.ts` |
| The app starts with neither files-service variable set, and then uses the stub | `lib/files-service/env.test.ts` |
| A files-service address with no secret, or a short secret, is refused or gives the stub | `lib/files-service/env.test.ts` |

No test reaches the network and no test makes a paid call: the files service has nothing to call, and the credit
gate is a test double in every unit test.

Not verified here: no local database was started for this PR (the machine has one shared instance pinned to fixed
ports, and resetting it would destroy four other agents' work), so the migration, the `package_exports` tests and
the isolation entry run for the first time in CI. No factory has opened any of these files, and the Phase 0 test
matrix of `docs/spec/04` has still not been run by anyone.

## Still owed after this revision

- **The export route itself.** Everything behind it is here and tested — the input builder, `packageCreditKind` for
  `withCredits`, `creditCharge` over the credits gate, `recordPackageExport` and the table — but the route is not
  mounted, for two reasons. X5b owns no path under `app/`; and the package's print files would have to be drawn on
  the same panels the package's patterns come from, while `lib/print` draws on the brand's pattern-library pattern
  and `03_patterns/**` now comes from X3's drafter (revision 1). Serving a package whose print files and patterns
  may disagree is worse than serving none, and `docs/spec/04`'s own Phase 0 test measures exactly that agreement.
  So `PrintSource` is the one seam left, and wiring it is an orchestrator task as `PatternSource` was.
- **The tables for the values no table holds**: the article's bill of materials with its consumption, the care-label
  wording per market in `country_rules.label_rules`, and the AQL plan per factory. Until they exist the gate
  refuses every real package, correctly, and names what is missing.
- **A map from the garment registry's option keys to the catalogue's option codes.**
- **The `_nest.dxf` as a real nested marker** rather than the sizes stacked: that is the files service's
  `nest_marker`, which owner decision 2 keeps unwired.
- **Renders**, **ICC colour**, **the Urdu tech pack** and **the Phase 0 factory test**, all unchanged from above.

## Owner questions

1. **Which white point and observer does the colour house work to, and was `docs/spec/04`'s `#0B1F4B` example
   measured or computed?** Owner decision 15 keeps our figure and records theirs as unverified; this is the owner
   action that decision names, and it is still open.
2. **Is the placeholder price right, and should a sample package for a partner factory be charged at all?** Owner
   decision 20 says it stays charged and that the owner may overturn it. **This is money**: nothing in the platform
   presents the number as a price, and `CREDITS_ENFORCED` is off, so no brand has been charged anything.

---

# 0070 revision 3: the print source, and the export route is mounted

Status: Proposed. Date: 2026-10-30. Plan step: `plans/platform-v5.md`, wave 1, workstream **X5** item 6, and
`plans/v5-handover-2026-10-30.md` section 6 item 1. No migration.

Revision 2 left one thing owed and said why: "`PrintSource` is the one seam left, and wiring it is an orchestrator
task as `PatternSource` was." This revision closes it and mounts the route.

## 1. The print files are drawn on the drafted pattern, not the library pattern

This is the judgement revision 2 stopped at. `lib/print` draws on the pattern in the brand's **pattern library**
(`lib/print/inputs/pattern.ts`, `loadDesignPattern`), while `03_patterns/**` comes from X3's **graded parametric
drafter** (`lib/kpp/sources/pattern.ts`, revision 1). A package whose print files and patterns disagree is worse
than no package, and `docs/spec/04`'s own Phase 0 test measures exactly that agreement.

**One pattern, one package.** `apps/web/lib/kpp/sources/print.ts` draws the print files on the very
`GradedPattern` that `03_patterns/**` is written from — the drafted one. `DesignPattern`, which is print's own
input, already carries a `GradedPattern`, which is what `draftedPattern` returns, so the shapes already lined up:
what was missing was the adapter and the per-panel call. The library pattern is not read by the package at all.

- `draftedDesignPattern(facts)` is the adapter. `reviewed` is **false**, and the note printed in every file's
  margin names the article, the article's own version ("0.1"), the platform's block version and the drafter, and
  ends with the pattern library's own `DRAFT_NOTICE`. The pattern is a Knitwright draft that no factory has
  reviewed (owner decision 10), and nothing in a file may read as a sign-off nobody gave.
- `printSource(input).source.files(size, orderNo)` plans and builds that size's files through `lib/print`'s public
  API only — `planPrintFiles`, `createPrintFileBuilder`, `makeFiles` and `fileStem`, driven together exactly as
  `lib/print/service.ts` already drives them. **No line of `lib/print` was changed.**
- The factory's `printFileType` picks the format: `pdf`, or `tif` through the print contract's `tiff`.
- **`panel` is `lib/print`'s own file stem**, which for a piece with nobody's name on it is the `PieceInstance.id`
  — the view the piece is printed for: `front`, `back`, `sleeve-left`, `sleeve-right`. That is what `printPath`
  composes into `SAMPLE_<article>_<panel>_<size>.<ext>` and what the package's own tests already expected. Taking
  the stem rather than the piece id keeps the two names one name the day a team list reaches this seam: the stem
  then carries the player's number and the transfer marks, so two files of one panel cannot land on one path.
- **Bleed and resolution are the package's own** (`KppInput.print`), so a file is made at the numbers
  `00_README.pdf` states and `lib/kpp/gate.ts` checked. The print house's colour profile, its largest width and
  whether those numbers are the print house's own still come from the brand's stored profile, which is where the
  margin note about defaults is taken from.
- A size the drafted pattern does not hold is a sentence naming the article and the size, not a crash inside the
  layout.

**Personalisation.** `files` takes the order number, because a batch groups `04_print` by order, but it makes the
same panels whatever the order: **no team list reaches this seam.**
`08_personalisation/names_numbers.csv` is a list of names and numbers, not a team order — `RosterRow` also wants
the cut and the quantity — and inventing either would make an unpersonalised file look personalised. So the
package says so in `00_README.pdf` instead, and the factory applies the names from the CSV. When a real team
order does reach the route, the roster goes to `planPrintFiles` and the panel name already carries the player.

**Known gap, not worked around.** The drafted sleeve carries `cap-top`, `hem-a` and `hem-b` but not
`underarm-a` / `underarm-b`, so `lib/print`'s `sleeveFrame` falls back to `boundsFrame`: artwork on a sleeve is
centred on the piece's bounds rather than aligned to its underarm. Body pieces have their landmarks and use them.
`lib/parametric` is not this PR's to change; it is an owner question below.

## 2. The export route

`apps/web/app/api/projects/[projectId]/production-package/route.ts`, `GET`, member auth,
`LIMITS.printFiles` (a package draws every panel and every pattern piece, so it is held like a set of print
files), `maxDuration = 60`.

`apps/web/lib/kpp/sources/server.ts` joins it to the database, in the idiom of `lib/make/server.ts`: the design
version and its tech pack, X1's base article and its points of measure, X4's design object with X8's moderation
results, X6's factory, capability, fabric, colour and country rows, the brand's print settings and artwork
reader, X3's drafter and `lib/print`. The assembler itself still reads no database, no environment and no clock.
The decisions that file would otherwise have to make are in `sources/rows.ts` and `sources/answer.ts`, which are
tested; `server.ts` is reads and a plain object, and it joins the coverage exclusion list beside
`lib/make/server.ts` for that reason.

- **The order is revision 2's**: check (F-G2), charge, build, record, send. So the route charges through
  `ChargeForPackage` / `creditCharge` and **not** through `withCredits`, which charges before the handler runs: a
  brand should never pay to be told what the factory still has to answer. The gate is built in `server.ts` with
  the same four lines as `lib/credits-gate/server.ts`, whose own gate is not exported. The credit headers
  `withCredits` would have added are added by `packageResponse`.
- `recordPackageExport` writes the `package_exports` row before the ZIP is sent, and throws if it cannot: a
  package a factory holds that the platform has no record of is a package nobody can check.
- A refusal is **409 with every gap named**, each with the field's dotted path and its rule id. Nothing about the
  request is wrong — the rows are simply not finished — and nothing is softened.
- The route exports a **sample** package. A batch is Knitwright's own production run, it needs orders, and ops
  owns that path.
- `next.config.ts` gains one `outputFileTracingIncludes` entry for the route. The package carries the tech pack
  PDF (@react-pdf/renderer, `registerPdfFont`) and the print files (`OUTLINE_FONT_FILE`), and both read
  `assets/fonts/Geist-Regular.ttf` from disk at run time, so without that line a deployed export fails on a
  missing file. It is the same entry the export route and the print-file route already have.

## 3. What the route refuses today, and why that is right

**A real design is refused**, by name, and the gate is not weakened to let it through. Three things no table
holds (revision 2, "Still owed"): the article's bill of materials with its consumption, the care-label wording in
`country_rules.label_rules` (seeded `{}`), and the AQL plan per factory. `KppUnsourced` is `NOTHING_UNSOURCED`
here, because the route has nowhere truthful to read them from, so those lines come out `needs_input` and the
refusal names each one. Two more follow from the same rule: no promised date can be worked out (QC days and
freight days are unset), and a colour difference no factory agreed makes the gate refuse rather than the package
stating a number (owner decision 15).

Who places the order is also not on file. `MADE_BY_KNITWRIGHT` is therefore `false` — the package is treated as a
brand's own export and charged at the labelled placeholder price, which is what owner decision 20 settled for a
factory Knitwright does not own — and `MADE_BY_NOTE` says exactly that in the package rather than letting the
answer pass unnoticed. `CREDITS_ENFORCED` is off, so nothing has been charged.

Moderation is reported, not assumed: `clear` is said only when every target of the design has a kept screening,
and a design with nothing screened is `not_built`, which the README states.

## Evidence

| Claim | Test |
|---|---|
| The print files are drawn on the same pattern object `03_patterns/**` is written from | `lib/kpp/sources/print.test.ts` |
| The pattern is a draft no factory reviewed, and the margin names the article, its version and the drafter | `lib/kpp/sources/print.test.ts` |
| The draft note reaches the file itself: two patterns cannot give one file | `lib/kpp/sources/print.test.ts` |
| One file per printed piece, named as `printPath` and the package's own tests name it | `lib/kpp/sources/print.test.ts` |
| The same design gives the same bytes twice | `lib/kpp/sources/print.test.ts` |
| A file is made in the factory's own format, and the print house's profile is carried when there is one | `lib/kpp/sources/print.test.ts` |
| A file is made at the bleed and resolution the package states, not the brand's own | `lib/kpp/sources/print.test.ts` |
| Pieces no print view is defined for are named in the package's notes, not dropped in silence | `lib/kpp/sources/print.test.ts` |
| A size the drafted pattern does not hold is a reason in words | `lib/kpp/sources/print.test.ts` |
| The design version is hashed as the credits gate hashes it, and pinned to when it was saved | `lib/kpp/sources/rows.test.ts` |
| `clear` is said only when every moderation target was screened; nothing screened is `not_built` | `lib/kpp/sources/rows.test.ts` |
| The print thresholds are the brand's own profile, with where they came from | `lib/kpp/sources/rows.test.ts` |
| A package the gate refuses is a 409 naming every gap with its field and its rule | `lib/kpp/sources/answer.test.ts` |
| The ZIP is sent once, never stored, with the credit headers when something was charged | `lib/kpp/sources/answer.test.ts` |
| The route is member-only, rate limited, takes one design id, and gives its answer back unchanged | `app/api/projects/[projectId]/production-package/route.test.ts` |

Not verified here: no local database was started for this PR (one shared instance on this machine, several agents
on it), so the route has not been called against real rows and no end-to-end spec was run; CI is their first run.
No factory has opened any of these files, and the Phase 0 test matrix of `docs/spec/04` has still not been run by
anyone.

## Still owed after this revision

- **The three tables with no owner** (BOM consumption, care-label wording, AQL plan), **the registry-option to
  catalogue-code map**, **the `_nest.dxf` as a real marker**, **renders**, **ICC colour**, **the Urdu tech pack**
  and **the Phase 0 factory test**, all unchanged.
- **A batch package has no route.** It needs orders and a job sheet, which is ops's path, not a brand's.
- **A screen that offers the download.** The route is mounted; no page links to it yet.
- **The sleeve's underarm landmarks** in `lib/parametric`, so artwork on a sleeve is placed by landmark rather
  than by the piece's bounds.

## Owner questions

1. **Should `lib/parametric`'s sleeve carry `underarm-a` and `underarm-b`?** Without them `lib/print` places
   artwork on a sleeve by the piece's bounds. Nothing is wrong in the file, and the margin says what it says, but
   a sleeve band will not line up with the body's chest line as exactly as it could. Adding two landmarks is a
   drafter change, not a print change.
2. **Who places the order?** Nothing on `factories` or on a capability says whether Knitwright or the brand
   places it, and that is what decides whether the package is free (spec decision 9, owner decision 20). The
   route charges, which is decision 20's answer for a factory Knitwright does not own, and says so in the
   package. **This is money.**
3. **Should the export route offer a batch package too**, or does a batch stay ops's own path? A batch adds the
   job sheet and groups print files by order, and its orders are ops rows.
4. **Which white point does the colour house work to** — still open, from revision 2.
