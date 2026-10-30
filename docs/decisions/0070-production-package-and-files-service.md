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
