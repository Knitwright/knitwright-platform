# 0110: The three journeys of plan v5, and what coverage really covers

Status: Proposed. The three journeys of the plan are browser tests now, and each one is asserted up to the wall
it stops at rather than around it. Three walls were expected and are reached honestly; four more were found.
The coverage figure holds every threshold and measures less than it looks like it measures. Owner questions
below.
Index: Proposed; the three v5 journeys written as browser tests with their stops asserted, four more walls found, `components/**` and 6,600 lines of `lib` seams outside the coverage figure, the F-G2 checklist has no caller, 44 of 62 specs run no axe scan, owner questions listed
Index title: The three journeys of plan v5, and what coverage really covers
Date: 2026-11-02
Plan step: `plans/platform-v5.md`, wave 5, R3 ("journeys and coverage (`coverage-v5.md`)"). Follows v4's W5-C
(`docs/reviews/coverage-v4.md`). Reads on decisions 0089 (the care label and the one F-G2 checklist), 0090 (the
seven base articles with no measurement), 0071 (the factory as data, and the promised date), 0087 (the committee
link and the roster sign-up), 0091 and 0108 (the launch panel contract), 0100 (ops completion), 0105 (crest to
kit) and 0106 (the Store contract).
Migration: none.

## Context

All thirty feature workstreams of plan v5 are merged. The plan names three journeys as the acceptance criteria
of the whole thing: the founder from a base article to a golden sample to a run hand-off; the club from
crest-to-kit to committee approval to the roster to the hand-off; ops from a batch to the job packet to QC to
the shipment. Nothing had ever walked any of them end to end. The pieces each have a spec; the joins did not.

Three walls were known before this review started and were expected to stop a journey:

1. **No care label prints in any market.** ISO 3758 is a paid standard and is not in this repository, so no
   care symbol has been transcribed (decision 0089). The production package refuses every order because of it.
2. **No delivery date exists anywhere.** `qcDays` and `freightDays` are both unset, so
   `lib/factory/dates.ts` answers "not set" and no screen may invent one.
3. **Seven of the eight base articles publish no measurement at all** (decision 0090), so their tech packs and
   size charts are refusals.

The question this review had to answer is therefore not "does it work" but **"does everything up to each wall
work, and is each wall reached with an honest message naming what is missing, rather than a crash, a blank, or
a plausible-looking fake?"**

## Decision

### 1. The three journeys are browser tests, and a stop is an assertion

`apps/web/e2e/journeys-v5.spec.ts` holds one test per journey, beside v4's `e2e/journeys.spec.ts`. They walk
real screens — the catalogue, the article page, the make pages, crest-to-kit, the configurator, Collect, the
public committee and sign-up pages, `/ops`, the batch page, the factory's own job packet, QC, packing and
shipping — and **no step is replaced by a fixture that would hide a gap.** Where a journey stops, the stop is
what the test asserts, in the platform's own words.

That is the whole method, and it is deliberate. A journey test that seeded its way past the care-label refusal
would pass for years and prove nothing; a journey test that asserts the 409 and the sentence inside it fails the
day somebody makes the refusal vaguer.

Each test gives itself its own account, brand, design name, order reference and **fabric key**, because
`ops_cut_batches` groups by factory, fabric, article and cut-off and reuses a batch it has already cut, and CI
retries a failed browser test once. **None of them inserts a factory row**: `lib/home/book.ts` prices the whole
catalogue from the first factory by slug, so a new slug sorting ahead of `sialkot-partner` would empty the price
ladder that `studio-catalogue.spec.ts` and `studio-collections.spec.ts` assert.

### 2. The three expected walls are reached honestly, on thirteen screens, with no invented value

Every one of them says what is missing and names nothing it does not know. The delivery date is the best-handled
thing in the platform: thirteen separate surfaces, one sentence, no date — `lib/factory/dates.ts` states the
rule in its own header ("Any missing part makes the date 'not set': no date is invented") and every screen obeys
it. `docs/reviews/coverage-v5.md` lists each surface and each wording.

The care label is right in the package's refusal (`Care label GB: missing care, size.`, rule `R-LAB-002`) and
right on the article page's market panel (the market row's own `gapNote`, which is the canonical wording of
decision 0089). The missing measurement is one sentence on the size chart and `Points of measure: none are
listed.` in the package refusal.

### 3. Four more walls, which this review found by walking the screens

| Wall | Where | What happens |
|---|---|---|
| **The production package has no screen** | the Export panel's own tab | A founder who hands a run to production is never told the package was refused. The refusal exists only on `GET /api/projects/{id}/production-package`, which the Store would call |
| **There is no screen that sends a club's kit to production** | `/teamwear` | `submit_order_for_production` is the Store's door, called with a service key. What a club can press answers *"Give your Store contact this reference: {projectId}@v{version}."* and stores nothing |
| **The committee lock needs a validated version** | `/collect` | *"This version has not been checked against a factory profile yet."* Recording a check needs a fabric test at `/brands/fabrics`, so a crest-to-kit kit can be approved and not locked on the same day |
| **No order can be invoiced** | `/ops/orders/{id}/shipping` | An order's `factory_profile_id` is a validation profile; `factories` holds only the slug `sialkot-partner`; nothing joins them, so the origin of the goods is never known |

None of the four crashes or fakes anything. All four are recorded as owner questions rather than fixed here:
three of them need a decision, and the fourth (the factory mapping) is one column in somebody else's table.

### 4. The F-G2 checklist has no caller

Decision 0089 built `lib/compliance/checklist.ts` so that three places would stop disagreeing about whether a
garment is ready. As of `08a18ea2`, **`preExportCheck`, `handOffGate`, `assertHandOffAllowed`,
`reviewStateFrom`, `subjectFromTechPack`, `subjectFromPackage` and `subjectFromOrder` have no caller outside
`lib/compliance/` and its own tests.** The Review tab still uses `lib/techpack/exports/review-gate.ts`, the
package still uses `lib/kpp/gate.ts`, and ordering uses `lib/make/gate.ts`. The directory reads 100% lines and
96.2% branches, and none of it is on a screen.

This review does not wire it, because that means editing three files belonging to three different workstreams in
a review branch. It is owner question 3, and it is the largest "tested but not wired" item in v5.

### 5. The coverage figure holds every threshold and measures less than it looks like

97.80% statements, 92.96% branches, 98.20% functions, 98.39% lines, against an 80% bar; **every one of the
fifty-six directory marks in `vitest.config.mts` holds, thirty-four of them new in v5.** The per-directory
discipline of the plan was kept.

Three things about the figure are recorded in `coverage-v5.md` rather than celebrated:

- **`coverage.include` is `lib/**/*.ts` only.** Sixty-six non-test `.ts` files under `components/` — among them
  the view model of L5's video studio, L3's shoot panel, the media screen and the launch shell's own hook — are
  never measured, although their tests run.
- **Thirty-three named seam files (2,861 lines) and every `lib/**/actions.ts` (41 files, 3,720 lines) are
  excluded**, about 6,600 lines the figure never sees. Each exclusion is reasonable on its own; together they
  are why `lib/store-contract` and `lib/job-packet` read 100% lines **and** 100% branches, and why `lib/home`
  went from 51.5% to 99.2% partly by moving its two worst files out of the measurement.
- **A threshold can be met by the easy half.** `lib/ops` reads 99.3% over 68 files while
  `lib/ops/qc/guard.ts` — the platform-admin check at the start of every ops write action, imported by nine
  action files — is at 0%.

### 6. Accessibility coverage is thinner than green CI suggests, and says why

**Eighteen of 62 spec files scan anything; 44 scan nothing.** For most of v5 the suite had **three** desktop
full-page scans — `studio-catalogue`, `templates`, `guided-flow` — and those three are exactly the specs that
caught the studio top bar's contrast fault (decision 0103). The `accessible()` helper in `e2e/chrome.ts` exists
*because of* that fault, and all seven specs that use it are from 0103 onward. The accessibility coverage the
platform has is, almost entirely, what one real bug forced into being.

**No `/ops` screen is scanned at a desktop width at all** (`/ops` itself only at 390 px), nor is `/job/{token}`,
the public page a factory uses, nor any auth or `/admin` screen, nor `/studio/{id}/tech-pack` at anything but
phone width. The full list is in `coverage-v5.md`.

The three new journey tests deliberately add **no** axe scans: a journey that also scanned every page it passed
would take minutes and would hide a scan failure behind a journey failure. Owner question 2 proposes where the
scans belong instead.

### 7. The panels that had no browser were a wiring gap, not a testing gap

On `main` at `08a18ea2`, four whole component directories — `components/shoots/**` (L3),
`components/marketing/**` (L4), `components/video/**` (L5) and `components/flows/**` (L6) — are imported by no
page and no shell. `RailPanels.tsx` mounts five of twelve rail panels and `Inspector.tsx` mounts one of five
board panels; the rest draw `panelPlaceholder(id)`. So "these panels have no browser test" is the wrong way
round: **they have no browser to be tested in**, which is why their directories read 99.8–100% from unit tests
that render them against `panelDouble()`.

`fix/v5-wave4-wiring` (#140) mounts them and brings its own browser spec for each. After it merges, what remains
unreachable from any route is `components/video/VideoStudio.tsx`, `components/flows/FlowTemplates.tsx`,
`FlowThumbnail.tsx` and `BoardActions.tsx`, plus the `likes` panel, whose placeholder is deliberate because
nothing in the platform records a like (decision 0108, and the right call).

**#140 and #143 both create `apps/web/e2e/launch-panels.spec.ts` and both edit `RailPanels.tsx`.** Whoever
merges #140 must take the union of both `BUILT` maps and both spec files, or three panels #143 mounted go back
to placeholders. This change touches neither file.

### 8. An enumeration is worth keeping when the list is a contract, not when it counts seed rows

`coverage-v5.md` sorts every enumerating test into two tables. `BOARD_KINDS`, `LAUNCH_PANELS`, the File menu,
the top bar's overflow links and `KINDS_SEEDED_HERE` are closed contracts: a new row there is a decision and
should fail a test. "The catalogue has 8 base products", "the Tools tablist has 11 tabs", "the size chart has 13
rows" and the seven exact code lists in `lib/catalogue/filters.test.ts` are a tax: they break on the plan's own
next step and say nothing about behaviour. `templates.spec.ts` shows the fix — it imports
`TEMPLATES_PER_PAGE` instead of writing 12.

## What was not done, and why

- **No gap test was added.** Every directory holds its threshold; the four under the overall bar
  (`lib/auth` 47.3%, `lib/supabase` 42.9%, `lib/brands` 59.5%, `lib/images` 75.0%) are the Supabase seam that
  v4 already recorded as a known gap and that `tests/integration` covers. The work this review found is wiring
  and accessibility, not missing unit tests.
- **No wall was moved.** Wiring the F-G2 checklist, mapping a factory profile to a factory row, giving the club
  a door into production and reaching the committee lock in one sitting are all owner decisions.
- **`coverage.include` was not changed.** Adding `components/**` drops the headline figure and needs its own
  per-directory marks; that is a decision, not a review's to take.

## Owner questions

1. Should `coverage.include` cover `components/**`? Sixty-six files holding whole workstreams' view models are
   unmeasured; including them will drop the figure and needs new marks.
2. Where should the missing axe scans go — one new spec that signs in as a platform admin and scans the ops
   screens, `/job/{token}` and the tech pack at a desktop width, or `accessible()` added to the specs that
   already open those pages?
3. Should the F-G2 checklist of decision 0089 be wired, and by whom? It means editing `lib/kpp/gate.ts`, the
   tech pack's Review tab and `lib/make/gate.ts`.
4. How does an order's `factory_profile_id` map to a row in `factories`? Today it does not, so no order can be
   invoiced, no ΔE reading can be judged, and the factory scorecard shows no card for any real order.
5. Should a club be able to send a kit to production at all, or is the Store reference the end of the journey
   by design? If it is, the Collect screen should say so where a club will read it.
6. Can a committee lock be reached in one sitting, or should it accept an approved-but-unchecked version with a
   warning?
7. Should `ops_cut_batches` be reachable from the batch screen for an order whose cut-off is in the future? Its
   button passes `now()`, so neither the button nor the cron route has any browser coverage of the platform's
   weekly mechanism.
