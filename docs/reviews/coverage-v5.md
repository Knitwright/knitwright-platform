# Coverage and journeys, v5 (R3)

Measured on `main` at `08a18ea2` with `pnpm --filter web exec vitest run --project unit --project pdf --coverage`
(the `db` project needs the shared local Supabase and is not part of the figure, as in v4).
1,151 test files, 21,657 tests, all passing. No file was excluded and no threshold was changed by this review.

**One pull request was still in flight while this was written**: `fix/v5-wave4-wiring` (#140), which mounts
wave 4's panels into the launch shell. Everything below about the launch panels says plainly which state it
describes, because that change is the difference between "built but unreachable" and "on a screen".

## Overall

| | v4 (W5-C) | v5 (R3) | Threshold |
|---|---|---|---|
| Statements | 96.54% | **97.80%** | 80% |
| Branches | 91.58% | **92.96%** | 80% |
| Functions | 96.86% | **98.20%** | 80% |
| Lines | 97.27% | **98.39%** | 80% |

The 80% overall bar is met with a very large margin, and **that margin is the least interesting number in this
document**. Two things about how it is produced matter more than its value, and both are in
[What the figure does not measure](#what-the-figure-does-not-measure).

## Lines covered, by directory under `lib/`

Branches are given as well, because a directory at 100% lines and 91% branches is a directory whose error paths
are the untested half. A dash means the directory did not exist in v4.

| Directory | v4 lines | v5 lines | v5 branches | 90% mark? |
|---|---|---|---|---|
| `lib/artwork-intake` | 99.7% | 99.6% | 93.2% | yes |
| `lib/artwork-stack` | 100.0% | 100.0% | 93.4% | yes |
| `lib/auth` | 47.3% | **47.3%** | 38.2% | no |
| `lib/benchmarks` | — | 99.8% | 94.0% | yes |
| `lib/brand-runs` | 100.0% | 100.0% | 98.1% | yes |
| `lib/brand-studio` | — | 100.0% | 98.0% | yes |
| `lib/brands` | 59.5% | **59.5%** | 26.3% | no |
| `lib/catalogue` | — | 100.0% | 99.2% | yes |
| `lib/charts` | 91.0% | 91.0% | 81.1% | no |
| `lib/clubs` | 98.6% | 99.3% | 93.7% | `reorder`, `signup` |
| `lib/collections` | — | 98.9% | 95.4% | yes |
| `lib/colour` | — | 100.0% | 92.9% | yes |
| `lib/comments` | 100.0% | 100.0% | 96.6% | yes |
| `lib/compliance` | — | 100.0% | 96.2% | yes |
| `lib/config` | 95.0% | 92.4% | 93.6% | no |
| `lib/consent` | 97.4% | 97.4% | 97.6% | no |
| `lib/copy` | 100.0% | 100.0% | 100.0% | no |
| `lib/credits` | 86.0% | 87.5% | 92.3% | no |
| `lib/credits-gate` | 100.0% | 100.0% | 90.6% | yes |
| `lib/crest-to-kit` | — | 99.7% | 93.0% | yes |
| `lib/cutting` | 99.1% | 99.1% | 90.3% | yes |
| `lib/deletion` | 100.0% | 100.0% | 89.3% | no |
| `lib/design-diff` | 98.8% | 98.8% | 93.8% | yes |
| `lib/design-import` | 99.6% | 99.4% | 91.6% | yes |
| `lib/design-object` | — | 100.0% | 94.0% | yes |
| `lib/designers` | 100.0% | 100.0% | 95.3% | yes |
| `lib/editor` | — | 99.6% | 94.8% | yes |
| `lib/fabrics` | 100.0% | 100.0% | 91.4% | yes |
| `lib/factory` | — | 99.4% | 94.7% | yes |
| `lib/files-service` | — | 100.0% | 95.7% | yes |
| `lib/flat` | 99.8% | 99.8% | 94.1% | yes |
| `lib/flows` | — | 99.8% | 93.7% | yes |
| `lib/forms` | 100.0% | 100.0% | 100.0% | no |
| `lib/garment` | 100.0% | 99.7% | 92.1% | yes |
| `lib/garment3d` | 98.3% | 98.3% | 88.0% | no |
| `lib/gltf` | 100.0% | 100.0% | 96.1% | yes |
| `lib/guardrails` | 100.0% | 100.0% | 97.8% | yes |
| `lib/guided` | 100.0% | 100.0% | 100.0% | no |
| `lib/home` | 51.5% | **99.2%** | 92.6% | yes |
| `lib/http` | — | 100.0% | n/a | no |
| `lib/images` | 75.0% | **75.0%** | 72.5% | no |
| `lib/inspiration` | — | 100.0% | 92.5% | yes |
| `lib/intent` | 99.2% | 99.3% | 88.3% | no |
| `lib/job-packet` | — | 100.0% | 100.0% | yes |
| `lib/kit-styles` | 100.0% | 100.0% | 89.5% | no |
| `lib/kpp` | — | 100.0% | 93.1% | yes |
| `lib/launch` | — | 100.0% | 95.9% | yes |
| `lib/launch-panels` | — | 100.0% | 91.7% | yes |
| `lib/leads` | 99.0% | 99.0% | 92.7% | no |
| `lib/legal` | 100.0% | 100.0% | 100.0% | no |
| `lib/make` | — | 100.0% | 93.7% | yes |
| `lib/marketing` | — | 99.8% | 98.2% | yes |
| `lib/markets` | — | 100.0% | 98.9% | yes |
| `lib/media` | 99.5% | 99.0% | 97.3% | yes |
| `lib/media-check` | 99.4% | 99.4% | 98.7% | yes |
| `lib/mockups` | — | 100.0% | 93.1% | yes |
| `lib/moderation` | — | 100.0% | 97.1% | yes |
| `lib/monitoring` | 87.8% | 91.5% | 87.5% | no |
| `lib/navigation` | 100.0% | 100.0% | 100.0% | no |
| `lib/ops` | 99.0% | 99.3% | 92.0% | yes |
| `lib/option-codes` | — | 100.0% | 100.0% | yes |
| `lib/orders` | 99.0% | 99.0% | 91.0% | yes |
| `lib/pagination` | 100.0% | 100.0% | 100.0% | no |
| `lib/panel-layers` | 97.6% | 99.0% | 91.7% | yes |
| `lib/parametric` | — | 99.8% | 98.6% | yes |
| `lib/pattern-generators` | 98.8% | 99.8% | 95.4% | no |
| `lib/pattern-library` | 99.6% | 99.6% | 94.1% | yes |
| `lib/patterns` | 82.5% | **82.5%** | 78.0% | no |
| `lib/pattern-service` | 100.0% | 100.0% | 96.9% | yes |
| `lib/print` | 99.5% | 99.5% | 92.9% | yes |
| `lib/production` | 100.0% | 100.0% | 95.0% | yes |
| `lib/profile` | 100.0% | 100.0% | 100.0% | no |
| `lib/projects` | 88.9% | **88.7%** | 88.0% | no |
| `lib/proofs` | 100.0% | 100.0% | 97.1% | yes |
| `lib/providers` | 99.1% | 99.1% | 86.1% | no |
| `lib/quotes` | — | 100.0% | 93.9% | yes |
| `lib/releases` | 100.0% | 100.0% | 95.7% | yes |
| `lib/repeat` | — | 100.0% | 98.3% | yes |
| `lib/rulebook` | — | 100.0% | 97.7% | yes |
| `lib/server` | 97.6% | 98.0% | 95.0% | no |
| `lib/settings` | 100.0% | 100.0% | 95.4% | yes |
| `lib/share` | 82.2% | **91.1%** | 82.9% | `committee` |
| `lib/shell` | — | 100.0% | 100.0% | yes |
| `lib/shoots` | — | 99.8% | 95.5% | yes |
| `lib/sizing` | 99.8% | 99.8% | 95.3% | yes |
| `lib/storage` | 94.4% | 94.8% | 88.7% | no |
| `lib/store-contract` | — | 100.0% | 100.0% | yes |
| `lib/supabase` | 14.3% | **42.9%** | n/a | no |
| `lib/teamwear` | — | 99.6% | 92.8% | yes |
| `lib/techpack` | 99.5% | 100.0% | 93.8% | yes |
| `lib/templates` | 100.0% | 100.0% | 96.0% | yes |
| `lib/translate` | — | 100.0% | 100.0% | yes |
| `lib/units` | 100.0% | 100.0% | 100.0% | no |
| `lib/usage` | 97.9% | 97.8% | 96.7% | no |
| `lib/validation` | 100.0% | 100.0% | 96.7% | yes |
| `lib/variants` | 100.0% | 100.0% | 93.1% | yes |
| `lib/workspace` | 100.0% | 100.0% | 98.2% | no |

**Every directory with a 90% mark in `vitest.config.mts` holds it.** Thirty-four of the fifty-six names on that
list are new in v5, so the per-directory discipline of the plan was kept.

### Below the 80% bar

Four directories are under the overall bar and pass only because the bar is applied to the total, not per
directory. All four are the same thing — the seam between the app and Supabase — and all four were under the bar
in v4 too:

| Directory | Lines | What is uncovered |
|---|---|---|
| `lib/auth` | 47.3% | `auth/service.ts` 0% (43 lines), `auth/queries.ts` 0% |
| `lib/supabase` | 42.9% | `supabase/clients.ts` 33% |
| `lib/brands` | 59.5% | `brands/service.ts` 38% |
| `lib/images` | 75.0% | `images/service.ts` 0% (43 lines) |

`lib/patterns` (82.5%, `patterns/service.ts` at 61%) and `lib/projects` (88.7%) sit just above it for the same
reason. These are reached by `tests/integration` and by the browser tests; the figure does not see them. Naming
them as a known gap is v4's position and this review does not change it.

## What the figure does not measure

### 1. `components/**` is outside the measurement entirely

`vitest.config.mts` sets `coverage.include: ["lib/**/*.ts"]`. The `unit` project **runs**
`components/**/*.test.ts`, so component tests contribute to the pass/fail of CI, but **no component source is
ever measured**. There are **66 non-test `.ts` files under `components/`** holding real logic, not markup —
among them `components/video/studio-model.ts`, `components/video/panel-model.ts`,
`components/shoots/panel-model.ts`, `components/media/screen/{model,state,timing,share,turntable}.ts`,
`components/launch/useLaunchShell.ts`, `components/launch/panels/panels.ts`, `components/marketing/panels.ts`,
`components/studio/editor/names-numbers/{state,zones,preview,colour,fonts}.ts`,
`components/studio/editor/repeat-maker/{state,publish,tile-canvas}.ts` and `components/club/reorder/model.ts`.

Several of these are the view model of a whole v5 workstream. Whether they are well tested is not knowable from
the coverage report; it has to be read file by file. **Owner question 1** below asks whether to extend `include`.

### 2. Thirty-three named seam files, and every `actions.ts`, are excluded

`coverage.exclude` names 33 files (2,861 source lines) plus `lib/**/actions.ts` (41 files, 3,720 lines) — about
6,600 lines of `lib` the figure never sees. Each exclusion carries a comment saying why, and each reason is
sound in isolation: the file joins tested rules to the database, the session or the environment and holds no
rules of its own. Taken together they change what a directory's percentage means. The clearest cases:

| Directory | v5 lines | What is excluded from it |
|---|---|---|
| `lib/home` | **99.2%** (was 51.5% in v4) | `load.ts` and `reads.ts` — the two files that were most of v4's 48% gap |
| `lib/store-contract` | 100.0% / 100.0% branches | `server.ts` (249 lines): the whole Store read path |
| `lib/job-packet` | 100.0% / 100.0% branches | `server.ts`: the packet's database, storage and file builders |
| `lib/kpp` | 100.0% | `sources/server.ts` and `sources/techpack.ts` |
| `lib/make` | 100.0% | `server.ts`: the make flow's reads, including the golden-sample gate's inputs |
| `lib/launch`, `lib/flows` | 100.0%, 99.8% | `server.ts` in both |
| `lib/benchmarks` | 99.8% | `load.ts` **and** `server.ts` |
| `lib/inspiration` | 100.0% | `server.ts` **and** `store.ts` |

`lib/home`'s jump from 51.5% to 99.2% is the one to be honest about: the directory did gain real tests in v5
(`book.ts`, `market.ts`, `article-view.ts`, `catalogue-filters.ts` are all well covered), **but part of the
improvement is that the two worst files were moved out of the measurement** rather than tested. The same applies
in miniature to `lib/share` (82.2% → 91.1%), whose `invite-service.ts` was excluded while `service.ts` is still
at 40%.

### 3. A threshold met by the easy half

Three directories hold a 90% mark while something load-bearing in them has no unit test at all:

- **`lib/ops` (99.3%, 68 files)** — `lib/ops/qc/guard.ts` is at **0%**. It is `opsContext`, the platform-admin
  check at the start of **every** ops write action: `moderation`, `exceptions`, `inspection`, `notify`,
  `invoice`, `packing`, `qc`, `shipping` and `pattern-service` all import it. Two lines, no unit test, inside a
  directory the config holds to 90%. `tests/architecture/ops-access.test.ts` and the 404 assertions in the
  browser specs do cover it in effect; nothing says so beside the file.
- **`lib/compliance` (100.0%)** — see [the compliance library with no consumer](#the-f-g2-checklist-is-a-library-with-no-consumer).
  Every rule is tested; nothing on any screen calls them.
- **`lib/projects` (88.7%, no 90% mark)** — `tech-pack-production.ts` is at 78% and `project-reads.ts` at 32%,
  while the tech pack's own directory (`lib/techpack`, 100%) passes its mark. The tech pack's maths is well
  tested; the code that assembles its inputs is the weakest non-excluded file in the repository.

Branch coverage is weakest in `lib/brands` (26.3%), `lib/auth` (38.2%), `lib/images` (72.5%),
`lib/patterns` (78.0%), `lib/charts` (81.1%), `lib/share` (82.9%) and `lib/providers` (86.1%).

## The three journeys

Each one is now a browser test in `apps/web/e2e/journeys-v5.spec.ts`. They walk the real screens. **Where a
journey cannot be completed the stop is the assertion**, in the platform's own words; nothing is forced with a
fixture that papers over a gap.

### 1. Founder: base article → golden sample → run hand-off

**How far it gets: all the way to a run order in `ops_orders`, and then stops at the production package.**

Everything on the way works and is honest about what it does not know:

| Step | Screen | What happens |
|---|---|---|
| The catalogue | `/catalogue` | All 8 base articles, each priced from the placeholder ladder and labelled as such |
| The article | `/catalogue/TEE-TR-01` | Size chart reads *"This article has no measurements on file yet. The build pack gives them for the worked article only."* — decision 0090, said once, in plain words |
| Start a design | `/catalogue/TEE-TR-01` → `/studio/new` | Works, but **no article code is handed over**: the page says `Choose "Crew neck tee" on the next screen.` and links to a bare `/studio/new`. The base article is re-derived server-side from the garment type |
| The make hub | `/studio/{id}/make` | *"No price is on file for this article yet."*, *"No delivery date yet…"*, and the run card shut with *"No golden sample has been signed off for this product yet."* |
| A sample | `/studio/{id}/make/sample` | Sent to production |
| The golden sample | `/studio/{id}/make/golden-sample` | Photo, measurement (*"Point A is 2 mm off, inside minus 10 to plus 10 mm."*), marks, sign-off |
| The run | `/studio/{id}/make/order` | Run gate now open; 60 pieces handed to production. The "Ready to ship by" filter is present and disabled, labelled **"Ready to ship by: no date yet"** |

**What stops it.** The order exists; the thing a factory makes the garment from does not.
`GET /api/projects/{id}/production-package` answers **409** with
*"This production package cannot be built yet."* followed by every gap, which for this article are
`Points of measure: none are listed.`, `Bill of materials: no lines.` and
**`Care label GB: missing care, size.`** (rule `R-LAB-002`). That is decision 0089 and decision 0090 arriving
together, and the refusal is exactly right: it names what is missing and guesses nothing.

Two findings about *how* it stops, rather than *that* it stops:

- **The production package has no screen at all.** The Export panel's own tab says
  *"The production package is built for the factory when the order is placed. There is no download for it here
  yet."* So a founder who hands a run to production is never told the package was refused: the refusal exists
  only on a route the Store would call. The journey reaches a wall it cannot see.
- **The hand-off itself does not run the F-G2 check.** The only gate on `Hand this order to production` is the
  golden sample (`lib/make/gate.ts`). A run can therefore be handed over for a design whose package will be
  refused, which is the thing decision 0089 set out to prevent.

#### The F-G2 checklist is a library with no consumer

Decision 0089 built one checklist, `lib/compliance/checklist.ts`, with three adapters, so that
*"a design the Review tab calls clear cannot fail at hand-off for a reason Review never showed"*. As of
`08a18ea2`, **`preExportCheck`, `handOffGate`, `assertHandOffAllowed`, `reviewStateFrom`, `subjectFromTechPack`,
`subjectFromPackage` and `subjectFromOrder` have no caller outside `lib/compliance/` and its own tests.** The
tech pack's Review tab still uses the older, smaller `lib/techpack/exports/review-gate.ts`; the package still
uses its own copy in `lib/kpp/gate.ts`; ordering uses `lib/make/gate.ts`. The directory is at 100% lines and
96.2% branches, and none of it is on a screen. This is the single largest "tested but not wired" item in v5.

### 2. Club: crest-to-kit → committee approval → roster → hand-off

**How far it gets: a crest becomes kits, a kit becomes a design, a committee approves it, the squad fills its own
roster in — and the version cannot be locked, and there is no screen that sends the kit to production.**

| Step | Screen | What happens |
|---|---|---|
| Crest to kit | `/crest-to-kit` | Six to nine kits from the club's own crest, each validated first; the palette reads the crest's own hexes back; **"No delivery date can be shown yet: the days for QC and the freight days are not set…"** |
| The quote | `Quote this kit` | A real PDF, `KWQ-…-quote.pdf`, whose Delivery row reads *"No delivery date yet. Not set: the days for QC and the freight days."* (asserted by `crest-to-kit.spec.ts`, not repeated in the journey) |
| The configurator | `/teamwear` | Opens the exact kit from the card; `Save` makes it a design at version 1 |
| Committee link | `/collect` | Made per design, address shown once |
| The committee | `/s/{token}` | A phone with no account: options, a pin, an approval recorded with name, time and version |
| The club's view | `/collect` | *"Dana the treasurer approved version 1 on …"*, with the email |
| The roster | `/club` | Season made; a CSV of three players saved |
| The squad | `/join/{token}` | A player with no account sends a shirt name, a number and a size; a number the sport does not allow is refused with *"A football number is 1 to 99."*; the club folds the answers into the season |

**What stops it, twice.**

1. **The committee lock.** `Lock version 1` is refused with
   *"This version has not been checked against a factory profile yet. Run the checks, then lock it."*
   (`committee_lock_version`, hint `not_checked`). The approval is kept; the choice cannot be made binding. To
   record a check a club must press `Record no blockers today` on the design's validation panel, and that button
   is disabled while the `readiness-fabric-test` blocker stands — which needs a fabric test recorded at
   `/brands/fabrics` and then attached to the design. So a crest-to-kit kit can be approved by its committee and
   **cannot be locked on the same day**. The refusal is honest and does not crash; the chain is four screens long
   and nothing on the Collect screen says so.
2. **The hand-off.** There is **no screen in this platform that sends a club's kit to production**.
   `lib/ops/contract.ts` records that `submit_order_for_production` is the only door into `ops_orders` and that
   the separate Store calls it with a service key; the only in-repo callers are the *brand* side's
   `Order sample` / `Order run` on `/brand`. What a club can press is
   `Order through the Knitwright Store`, which answers
   *"Give your Store contact this reference: {projectId}@v{version}."* and stores nothing. The footer says so
   plainly (*"Knitwright does not take payment here…"*) and never says "Add to cart", which is the right
   behaviour for a platform whose Store does not exist (owner decision 1) — but it means the club journey's last
   step is a reference string, not an order.

Also worth recording: `/teamwear`'s own `Quote` button is **not** the quote. It answers
*"The quote PDF is not switched on yet. The prices above are the ones it will carry."* The working quote is the
`Quote this kit` link on a crest-to-kit card. Two buttons named Quote, one of which works.

### 3. Ops: batch → job packet → QC → shipment

**How far it gets: all the way to a recorded shipment. The commercial invoice is the only thing refused.**

| Step | Screen | What happens |
|---|---|---|
| The batch | `/ops` | The order waits; *"No lead time is set, so no due date is promised."* |
| The cut | — | See below: **this cannot be done from the screen** |
| The batch page | `/ops/batches/{id}` | The order is in the batch, `Promised` reads **Not set** |
| The factory link | `/ops/batches/{id}` | One live packet per batch, address shown once |
| The job packet | `/job/{token}` | A factory with no account: **`Due date: Not set`** and *"No lead time has been set, so no due date is promised yet."*; the job sheet really is a PDF and the ZIP really is a ZIP; `Received` → `In production` → `Ready for QC`, one step at a time |
| QC | `/ops/orders/{id}/qc` | Level II, **code letter H, 50 pieces inspected out of 400**, and the plan says it was typed from a republished copy and not read against ISO 2859-1; a ΔE reading is kept and *not* judged, because this factory has no agreed tolerance; a third-party inspection is offered over 300 pieces and **nothing is booked**, which it says |
| Packing | `/ops/orders/{id}/packing` | Bags made |
| The shipment | `/ops/orders/{id}/shipping` | No blocker (the inspection passed); parcel recorded; *"Entered by hand. Nothing is sent to a courier, and no label is booked."* |
| The customer | `/ops/orders/{id}` | *"We are not giving you a delivery date yet: the days for quality checks and the days in transit are not agreed, so any date would be a guess."* |

**What stops it.** The commercial invoice. `Issue the invoice` is refused with
*"The factory "{profile}" is not on file, so the country the goods were made in is not known. Add the factory at
/ops/factories."* Only `sialkot-partner` is seeded in `factories`, and the `factory_profile_id` an order carries
is a **validation profile** (`knitwright-default`), not a factory slug. So in practice **no order placed through
`submit_order_for_production` today can be invoiced**, because nothing maps the one to the other. The goods can
ship; the paperwork cannot be written. **Owner question 4.**

**And one finding about the first step.** *A batch cannot be cut from the batch screen in a test, and arguably
not in life either.* `Cut batches now` calls `ops_cut_batches(actor, now())`, and a new order's `cutoff_at` is
the **next** weekly cut-off, so the button never affects an order placed today. Every spec that needs a batch —
`ops.spec.ts`, `ops-qc.spec.ts`, `job-packet.spec.ts`, `journeys.spec.ts` and this new one — calls the function
directly with the clock moved forward. The button's own path (an order already past its cut-off) therefore has
**no browser coverage at all**, and neither does the scheduled route: `ops-completion.spec.ts` only asserts that
`/api/cron/ops-cut-batches` answers 404 or 503 because no `CRON_SECRET` is set where the tests run. The one
mechanism that moves every Class A order in the platform is exercised only through its RPC.

### The three walls, as they actually appear

The brief named three expected walls. All three are real, all three are reached with an honest message, and
**none of them crashes, blanks or fakes a value**. Where each one surfaces:

| Wall | Surfaces | Wording |
|---|---|---|
| **No care label in any market** (ISO 3758, decision 0089) | the production-package route (409); the article page's Market panel; the Store contract's `sellable` blocker | *"ISO 3758 is a paid standard and is not in this repository, so no care symbol has been transcribed, redrawn or written down from memory…"* on screen; `Care label GB: missing care, size.` in the package refusal |
| **No delivery date anywhere** (`qcDays` and `freightDays` both unset) | `/catalogue/{code}`, `/studio/{id}/make`, `/make/sample`, `/make/order` (footer, per product, and a disabled filter chip), `/crest-to-kit`, the quote PDF, `/ops`, `/ops/batches/{id}`, `/job/{token}`, the customer email, `/ops/scorecard`, the Store contract | always `Not set: …` naming the missing parts; never a date |
| **Seven of eight base articles publish no measurement** (decision 0090) | `/catalogue/{code}`'s size chart; the package refusal's `Points of measure: none are listed.` | *"This article has no measurements on file yet. The build pack gives them for the worked article only."* |

The second wall is the best-handled thing in the platform: thirteen separate surfaces, one sentence, no invented
date. `lib/factory/dates.ts` says it in its own header — *"Any missing part makes the date 'not set': no date is
invented."* — and every screen obeys it.

## What has no browser test at all

### Routes with no browser coverage

Of 68 page routes, three are never opened by any spec:

| Route | What it is |
|---|---|
| `/studio/charts` | The brand's size charts and the chart import screen. The route is only ever seen as a **link** in the top bar's overflow menu (`studio-chrome.spec.ts`); the screen itself, and `ChartImport`, are never opened |
| `/studio/{id}/kit-styles` | The kit-styles screen. No spec mentions it |
| `/studio/{id}/delete` | "Move to trash". `editor-shell.spec.ts` asserts the File menu **offers** the link; nothing follows it |

Everything else is reached, including `/ops/batches/{id}`, `/ops/pattern-requests/{id}`,
`/studio/benchmarks/{id}` and `/studio/collections/{id}`, which are navigated to by clicking rather than by
`goto` and so do not show up in a path grep.

### Panels and screens built before they were mounted

This is where v5's real coverage hole is, and it is not a testing hole — it is a **wiring** hole. On `main` at
`08a18ea2`, four whole component directories are imported by **no page and no shell**:

| Directory | Workstream | Files | Reachable in a browser on `main`? |
|---|---|---|---|
| `components/shoots/**` | L3, decision 0093 | `ShootsPanel`, `AiImageBoardPanel`, `BoardSections` | **no** |
| `components/marketing/**` | L4, decision 0094 | 6 panels + 7 supporting components | **no** |
| `components/video/**` | L5, decision 0095 | `AiVideoPanel`, `VideoStudio`, `VideoPlayer` | **no** |
| `components/flows/**` | L6, decision 0096 | `FlowCanvas`, `FlowRunPanel`, `InfoCardPanel`, `FlowBoardCard`, `BoardActions`, `FlowTemplates`, `FlowThumbnail` | **no** |

`components/launch/RailPanels.tsx` mounts only `mockups`, `photos` and (since #143) `templates`, `uploads`,
`brand`; `components/launch/Inspector.tsx` mounts only `board-mockup`. The rail's `ai-image` tab and the
`board-ai-image`, `board-ai-video`, `board-marketing`, `board-info-card` and `flow-run` panels all draw
`panelPlaceholder(id)`. So **"these panels have no browser test" is the wrong way round: they have no browser to
be tested in.** Their unit tests render them directly with `panelDouble()`, which is why their directories read
99.8–100%.

**#140 fixes most of this**, and brings its own `e2e/launch-panels.spec.ts` that opens each panel and scans it
with axe at a desktop width and at 390 × 844. After it merges the remaining unreachable components are:

- `components/video/VideoStudio.tsx` — L5's video studio screen (decision 0095) is mounted by no route;
- `components/flows/FlowTemplates.tsx` and `FlowThumbnail.tsx` — L6's flow template gallery;
- `components/flows/BoardActions.tsx`;
- the `likes` rail panel, which keeps its placeholder **deliberately**, because nothing in the platform records
  a like (decision 0108, and the right call: an empty grid with a heart on it would be a feature that looks real).

**#140 and #143 both create `apps/web/e2e/launch-panels.spec.ts` and both edit `RailPanels.tsx`.** Whoever
merges #140 must take the **union** of both `BUILT` maps and both spec files, or three panels #143 mounted go
back to placeholders and its tests go with them. This review's own change touches neither file.

The brand-studio import screen (`/brand-studio/import`) named in the brief **is** covered now: #143 added five
tests for it, including an axe scan at desktop and at phone width. The list in the brief was written before
#143 merged.

## Accessibility coverage

**62 spec files. Eleven import `AxeBuilder`; seven more call `accessible()` from `e2e/chrome.ts`.** So 18 of 62
specs scan anything, and 44 do not. The suite runs one Playwright project, `chromium` / Desktop Chrome, so
"desktop" below means the default viewport and "phone" means a `test.use` or a context at 390 × 844.

### Every scan in the suite

| Spec | Scope | Viewport | Pages |
|---|---|---|---|
| `studio-catalogue.spec.ts` | whole page | desktop | `/studio`, `/catalogue`, `/catalogue/JSY-SS-01` |
| `templates.spec.ts` | whole page | desktop | `/templates` |
| `guided-flow.spec.ts` | whole page | desktop | `/studio/start`, every step |
| `brand-studio.spec.ts` | whole page | desktop | `/brand-studio`, `?tab=colours` |
| `brand-runs.spec.ts` | whole page | desktop | `/brand`, empty and filled |
| `club.spec.ts` | whole page | desktop | `/club` |
| `make.spec.ts` | whole page | desktop | `/make/sample`, `/make/golden-sample`, `/make/order` |
| `studio-chrome.spec.ts` | whole page | desktop + phone | `/studio` with the top bar's overflow open |
| `launch-panels.spec.ts` | whole page | desktop + phone | the rail panels of #143, `/brand-studio/import` |
| `mobile.spec.ts` | whole page | **phone only** | `/studio`, a design, its tech pack, `/templates`, `/club`, `/credits`, `/ops` |
| `committee.spec.ts` | whole page | **phone only** | `/s/{token}` |
| `roster-signup.spec.ts` | whole page | **phone only** | `/join/{token}` |
| `crest-to-kit.spec.ts` | `[data-testid="crest-to-kit"]` | **phone only** | `/crest-to-kit` |
| `benchmarks.spec.ts` | `main` | desktop + phone | `/studio/benchmarks`, `/studio/benchmarks/{id}` |
| `launch.spec.ts` | `[data-testid="launch-shell"]` | desktop | `/launch/{id}` |
| `mockups.spec.ts` | `launch-shell`, `launch-inspector` | desktop | `/launch/{id}` |
| `rulebook.spec.ts` | `[role="dialog"]` | desktop | the Why? popover only |
| `accessibility.spec.ts` | **no axe at all** | phone | a keyboard focus-trap test, which is a different thing |

The brief's reading is right, and worth stating precisely: **for most of v5 the suite had three desktop
full-page scans** — `studio-catalogue`, `templates` and `guided-flow` — and those three are exactly the specs
that caught the studio top bar's contrast fault (decision 0103, `text-muted` at 3.35:1 over the aurora). The
`accessible()` helper in `e2e/chrome.ts` was written **because of** that fault, and the seven specs that use it
are all from decision 0103 onward. So the accessibility coverage that exists is, almost entirely, the coverage
one real bug forced into being. Green CI before it meant very little.

### Pages with no axe scan at all

- **Every `/ops` screen at a desktop width.** `/ops` is scanned at 390 px only (`mobile.spec.ts`). `/ops/batches/{id}`,
  `/ops/orders/{id}`, `/ops/orders/{id}/qc`, `/packing`, `/shipping`, `/ops/exceptions`, `/ops/factories`,
  `/ops/scorecard`, `/ops/settings`, `/ops/review`, `/ops/pattern-requests`, `/ops/pattern-requests/{id}` —
  **none at any width**. These are the densest tables and the most form-heavy pages in the product.
- **`/job/{token}`** — the public page a factory with no account uses, with three forms and a file upload on it.
  No scan at any width.
- **Every auth and onboarding page**: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`,
  `/auth/confirm`, `/welcome`.
- **Every `/admin` screen**: `/admin/leads`, `/admin/settings`, `/admin/templates` (`/admin/rulebook` has a
  dialog-only scan).
- `/settings`, `/brands`, `/brands/fabrics`, `/studio/charts`, `/studio/collections`,
  `/studio/collections/{id}`, `/designer`, `/designer/new`, `/teamwear`, `/collect`,
  `/studio/{id}/layers`, `/studio/{id}/kit-styles`, `/studio/{id}/delete`, `/studio/{id}/guide`,
  `/studio/{id}/pattern-service`, `/launch` (the list page; only the shell inside `/launch/{id}` is scanned).
- `/studio/{id}/tech-pack` is scanned at **390 px only**, never at a desktop width, although it is the screen
  with the largest tables in the app.
- `/legal/{document}`, `/unsubscribe`, `/report-a-mark`.

The three new journey tests in this change deliberately add **no** axe scans: a journey that also scanned every
page it passed would take minutes and would hide a scan failure behind a journey failure. **Owner question 2**
proposes where the scans should go instead.

## Tests that enumerate a list

These break when anyone adds a row. Some of them should.

### Good guards — the list *is* a contract, and a new row is a decision

| Test | Enumerates | Why it earns it |
|---|---|---|
| `lib/launch/boards.test.ts:16` | `BOARD_KINDS`, the paid ones, the add-menu ones, `kindsAddableAfter` | The spec's board table. A new kind that nobody decided about should fail |
| `lib/launch/panels.test.ts`, `rail.test.ts` | `LAUNCH_PANELS`, `PANEL_OF_KIND` | L1's panel contract, which five workstreams build against |
| `components/launch/panel-mounting.test.ts` (#140) | which panels are mounted vs placeheld | Holds the same list as the browser spec, so the two cannot disagree about what is still to come |
| `lib/templates/kinds/index.test.ts:59` | `KINDS_SEEDED_HERE` | A new template kind silently breaking `loadLibrary` is the exact failure decision 0098 warns about |
| `lib/templates/kinds/tags.test.ts:42` | `TAG_GROUPS` | Closed vocabulary |
| `editor-shell.spec.ts:237` | the File menu's six items, in order | A menu item appearing or vanishing is user-visible |
| `studio-chrome.spec.ts:43` | the overflow menu's six links **and their hrefs** | Decision 0103's whole point was sections that had no door |
| `templates.spec.ts:43,90` | 12 list items — but by **importing `TEMPLATES_PER_PAGE`** | Derived from the source, not a literal. This is the pattern the others should follow |
| `tests/architecture/*` | offenders, asserted empty | Self-maintaining: a new file is checked, not counted |

### Maintenance tax — a count that says nothing about behaviour

| Test | Enumerates | Why it is a tax |
|---|---|---|
| `studio-catalogue.spec.ts:104` | `Base products` list has **8** `<li>` | A ninth base article is the plan's own goal. The number is in the brief of a future workstream and in a spec nobody will think to look at. `lib/catalogue/filters.test.ts:27` asserts the same 8 again |
| `studio-catalogue.spec.ts:167` | the size chart has **13** rows | A POM added to `JSY-SS-01` breaks a test about the catalogue screen |
| `studio-catalogue.spec.ts:156,193` | 4 price-ladder rows, 5 label lines | Both are seed data a workstream will extend |
| `editor-shell.spec.ts:73` | the Tools tablist has **11** tabs | A twelfth tool is a feature, not a regression |
| `launch.spec.ts:69` | the Panels tablist has **12** tabs | Same |
| `studio-chrome.spec.ts:152` / `brand-studio.spec.ts:78` | 10 / 7 navigation links | Same |
| `teamwear.spec.ts:142` | the tool rail has **7** buttons | Same |
| `editor.spec.ts:199` | `optgroup[label="Tops"]` has **5** options | Breaks whenever the garment registry gains a top |
| `lib/catalogue/filters.test.ts:31-61` | the exact code list for each filter | Seven assertions that each name every article a filter matches. A new article changes several at once |
| `tests/architecture/ops-access.test.ts:109` | one literal entry-point string | The only hard-coded path in an otherwise self-maintaining file |

The honest summary: the enumerations that name a **closed contract** are worth keeping and should say so in a
comment; the enumerations that count **rows of seed data** are a tax, and `templates.spec.ts`'s trick of
importing the constant is the fix for all of them.

## Owner questions

1. **Should `coverage.include` cover `components/**`?** Sixty-six non-test `.ts` files there hold the view models
   of entire v5 workstreams and are not measured at all. Including them will drop the headline figure (most of
   `components/**` is `.tsx` that no unit test renders) and will need a per-directory mark to be useful. The
   alternative is to leave it and say in `vitest.config.mts` that the figure is about `lib` only.
2. **Where should the missing axe scans go?** The cheapest honest fix is one new spec that signs in as a platform
   admin and runs `accessible()` over the ops screens at a desktop width, plus a scan of `/job/{token}` and one of
   `/studio/{id}/tech-pack` at desktop. That is about 15 scans and a few minutes of CI. Should it be its own spec,
   or should `accessible()` be added to the specs that already open those pages?
3. **Should the F-G2 checklist be wired, and by whom?** `lib/compliance/checklist.ts` has no caller. Until it
   does, the Review tab, the production package and ordering each use a different check — which is the state
   decision 0089 was written to end. Wiring it means editing `lib/kpp/gate.ts`, the tech pack's Review tab and
   `lib/make/gate.ts`, three files belonging to three different workstreams.
4. **How does an order's `factory_profile_id` map to a row in `factories`?** Today it does not, so **no order
   can be invoiced**, the scorecard shows no card for any real order, and no colour reading can be judged.
   `knitwright-default` is a validation profile and `sialkot-partner` is a factory; nothing joins them. This is
   one column or one lookup table, and it unblocks the commercial invoice, the ΔE verdict and the factory
   scorecard at once.
5. **Should the club be able to send a kit to production at all?** The club journey's last step is a reference
   string for a Store that does not exist. That may be exactly right (owner decision 1), but a club that has a
   locked design, a full roster and a price has nothing left to press. If the answer is "the Store does it",
   the Collect screen should say so where the club will read it.
6. **Can a committee lock be reached in one sitting?** Locking needs a validated version, validating needs a
   fabric test, and a crest-to-kit kit has neither. Either the lock should accept an approved-but-unchecked
   version with a warning, or the Collect screen should name the fabric test as the next step.
7. **Should `ops_cut_batches` be reachable from the screen for a test?** `Cut batches now` passes `now()`, so
   neither it nor the cron route has any browser coverage. An ops-only "cut as if it were \<date\>" control, or a
   test-only parameter, would put the platform's weekly mechanism under a browser test.

## Gap tests added

None. Every directory holds its threshold, and the four below the overall bar are the Supabase seam that v4
already recorded as a known gap and that `tests/integration` covers. The work this review found is wiring and
accessibility, not missing unit tests, and the three journeys are where it put its effort.

## Journeys added

`apps/web/e2e/journeys-v5.spec.ts`, three tests, one per journey, alongside v4's `e2e/journeys.spec.ts`:

1. **The founder** — `/catalogue` → `/catalogue/TEE-TR-01` → `/studio/new` → `/make` → `/make/sample` →
   `/make/golden-sample` → `/make/order`, then the production package's 409 with the care label named in it.
2. **The club** — `/crest-to-kit` → `/teamwear` (save and hand-off) → `/collect` (committee link) →
   `/s/{token}` on a phone with no account → the lock's refusal → `/club` (season and CSV) → `/collect`
   (sign-up link) → `/join/{token}` on a phone → the answers folded in.
3. **Ops** — `/ops` → `ops_cut_batches` → `/ops/batches/{id}` → the factory link → `/job/{token}` in a context
   with no session → `/ops/orders/{id}/qc` → `/packing` → `/shipping`, where the invoice is refused and the
   parcel is recorded.

Each gives itself its own account, brand, design name, order reference and **fabric key**, because
`ops_cut_batches` groups by factory, fabric, article and cut-off and reuses a batch it has already cut, and CI
retries a failed browser test once. **No factory row is inserted by any of them**: `lib/home/book.ts` prices
the whole catalogue from the first factory by slug, so a new slug would empty the price ladder other specs
assert. The author had no database of their own, so these specs were written against the passing neighbours'
helpers and labels and run for the first time in CI.
