# 0100. Ops completion: the scheduled cut, the AQL table, ΔE at QC, the commercial invoice, couriers, status emails and the factory scorecard

Status: Proposed; the AQL figures are seeded with no source cited, owner questions listed.

Plan: `plans/platform-v5.md`, wave 5, workstream **O1**. Features **F-O1**, **F-O3**, **F-O4**, **F-O6**.
Continues decision 0043 (ops batches), 0050 (QC, packing, shipping, exceptions) and 0071 (the factory model as data).

Migration: `supabase/migrations/20261210010000_ops_completion.sql` (wave 5's date, the next free hour).

---

## 1. The weekly cut runs from a Vercel cron route, not a database cron

**Decided: a Vercel cron route at `/api/cron/ops-cut-batches`, firing hourly, behind the deploy's own `CRON_SECRET`.**

Why not a Supabase cron:

- The cut-off is a **setting** (`ops_settings.cutoff_weekday` and `cutoff_time`, which ops changes at `/ops/settings`), so
  the schedule cannot *be* the cut-off. Whatever runs it has to ask "has a cut-off passed since the last run". A
  `pg_cron` entry whose expression had to be rewritten every time ops moved the cut-off would be a second copy of the
  setting, and the two would drift.
- `pg_cron` and `pg_net` are not enabled on this project, and switching them on means editing `supabase/config.toml`,
  which every workstream is forbidden to touch. A database cron would also run on the database's clock with no
  connection to the deploy that owns the settings, and nothing in the app would see that it had happened.
- The route is where the rest of the platform's scheduled work will go, it shows up in the deploy's own logs, and it
  can be run by hand against a deploy when ops needs to.

What the route is **not**: it is not the cut-off and it is not a timer for one. `vercel.json` fires it at `0 * * * *`
— an hourly tick, no more. `public.ops_cut_scheduled` works out the latest cut-off at or before its clock
(`private.last_cutoff`, the mirror of `private.next_cutoff`) and cuts for that.

**Idempotency.** `ops_cut_runs.cut_for` is unique, and `ops_cut_scheduled`:

1. takes a transaction advisory lock, so two ticks at once are serialised;
2. answers `ran: false` with the run already on file when one exists for that cut-off;
3. otherwise cuts, then writes the run row with the count it cut.

So a cron that fires twice in a week cuts one set of batches, and the second answer says plainly that the cut-off was
already cut. The run row is append-only, like every other ops record. The database test proves both halves.

**Who may run it.** There is no session: the scheduler sends `authorization: Bearer <CRON_SECRET>`, compared in
constant time. **Without the secret set the route answers 503 and cuts nothing** — an open cut is worse than a cut
that never happens. A wrong secret answers 404, like any other route a stranger finds. `ops_cut_scheduled` takes no
actor at all (a scheduled cut has no human behind it) and is granted to the service role only; the order events it
writes keep a null actor, which `ops_order_events` already allows. The route is the one entry in
`PUBLIC_ENTRY_POINTS` that touches ops, and `tests/architecture/ops-access.test.ts` now allows exactly that one and
still fails on any other.

## 2. The AQL level II table is seeded with **no source cited**, and it decides nothing

The spec (F-O3, rule `R-QC-001`) names "AQL 0 critical / 2.5 major / 4.0 minor at inspection level II" and cites "AQL
standard (ISO 2859-1)". **ISO 2859-1 is a paid standard, and no copy of it — and no page reproducing its tables —
could be reached while this was written.** Three candidate sources were tried and none served the tables.

The brief's rule is that a figure with no published source is a labelled placeholder plus an owner question. The
owner also asked for the table as seeded data. Both are honoured this way:

- `ops_aql_sample_plans` (lot band → code letter → sample size) and `ops_aql_acceptance` (code letter × AQL → accept,
  reject, or the table's arrow) are **rows**, so no lot band, sample size or accept number is a literal in code;
- every seeded row has `source = null` and `sourced = false`, tied together by a check constraint, and a label that
  says it was typed from the republished level II table and that nobody has read it against the standard;
- `lib/ops/aql/plan.ts` carries that through: a plan built from those rows answers `sourced: false`, and the QC screen
  prints `UNSOURCED_PLAN_NOTE` beside it;
- **nothing lets an unsourced row decide anything.** The inspection's result is still the inspector's four typed
  verdicts, the measurements against their own tolerances, the defect count and the colour readings. The sample size
  the plan gives is a pre-filled suggestion the inspector can change, and the code letter is recorded on the
  inspection only as "this is the plan it was taken under".

The "AQL 0" column is **not** a column of ISO 2859-1 at all (its lowest AQL is 0.010). It is the garment trade's
shorthand, which the spec uses, for "no critical defect is accepted": accept at 0, reject at 1 at every sample size.
It is seeded as that and labelled as the spec's convention, not as a figure out of the standard.

With an empty table the answer is `{ status: "not-on-file", missing: [...] }` and the screen names what is missing.
Nothing is ever worked out from no rows.

**Coordination with Z8.** Workstream Z8 is seeding the *per-factory AQL plan*. `main` carried no AQL rows when this
was written: the only AQL text anywhere was the production package's `aqlPlan` sentence (`lib/kpp/input/quality.ts`,
owner decision 19), which is a sentence on a document and not a table. So this adds the sample-size table as the
first source of truth for it. If Z8's per-factory plan lands, the join is `ops_aql_acceptance` (what the standard
says) × Z8's rows (what a factory agreed), and the per-factory row wins where the two differ.

## 3. ΔE readings are typed, and are judged only by a tolerance on file

`ops_qc_colour_readings` keeps, per reading: the colour, the Lab values it came from when they were measured, the ΔE
the instrument gave, and **`limit_delta_e`, the factory's own tolerance copied onto the reading**, so the judgement
can be read back later — the same idiom as `golden_sample_poms` and `golden_sample_colour_readings` (decision 0080).
The difference formula, instrument, white point and observer are nullable and never filled in for the inspector.

- A reading whose limit is on file and is over it **fails the inspection**, in the database
  (`private.ops_colour_readings_pass`) and in `evaluateInspection`, which the database test holds to each other.
- A reading with **no** limit on file fails nothing: it is recorded, and the screen says that nothing on file says
  whether it passes. No tolerance is invented.
- Where the limit comes from: `factory_capabilities.colour_delta_max` (rule `R-SUB-005`), through the factory profile.
  A factory's tolerance is agreed per fabric, and an ops order names its fabric by the Store's own key, which does
  not map to a programme fabric code yet. So `colourLimitOf` takes a limit **only when the factory holds the same
  tolerance on every fabric it makes**; anything else is "not on file", with the reason on screen. That mapping is
  owner question O1-3 below.

`ops_record_inspection` and `ops_record_shipment` were **dropped and written again** with their extra arguments rather
than overloaded: an overload with defaults would make every existing call ambiguous. Their behaviour is otherwise
unchanged.

## 4. Third-party inspection is a provider interface with a deterministic stub

`InspectionProvider.book()` with one implementation: `stubInspectionProvider`, which **reaches no network, books
nothing, invents no date** and hands back a reference derived from the order's reference and the day asked, so the
same request always gives the same reference. `ops_inspection_bookings` is append-only: a change of plan is a new
booking. The threshold is the setting `ops.third_party_inspection_over_pieces`, seeded at the spec's own 300 (F-O3:
"runs over 300 pieces"), under "Factory terms" at `/admin/settings` — a setting rather than a literal so the owner can
move it without a deploy. No price and no turnaround is shown: no inspection house has quoted either.

Metering: there is one seam (`bookInspection`) where a real adapter would be called, and that is where metering goes
when there is something to meter. Nothing paid is called today.

## 5. The commercial invoice is a record, and names what it cannot state

`ops_commercial_invoices` is append-only and numbered per order from 1; a correction is a **new** invoice that names
the one it replaces. The PDF is rendered from the record, never from the rows as they are now, so a reprint of
invoice 1 always shows what invoice 1 said.

Every field comes from a row: the HS code and the origin from `base_articles` (`hs_code`, `origin`, found by the
registry type the order names), the country the goods were made in from `factories.country`, the preference scheme
from `country_rules.preference_scheme` (**DCTS** for the United Kingdom), the value from what the Store gave.

- **An HS code that is not on file is left blank** and printed under "What this invoice cannot state". A customs
  document with a guessed tariff heading is worse than one with a gap.
- A factory that is not on file, or a destination nobody chose, **blocks** the invoice with a sentence saying what
  would clear it.
- **No delivery date appears anywhere on the document**, because QC days and freight days are both unset
  (decision 0071): it prints "No delivery date is stated: the days for QC and the freight days are not set, so none
  can be worked out."

## 6. Couriers are rows; the manual option is the only implementation

`ops_couriers` holds each courier's name, its terms as agreed, the calendar days it takes when a figure is agreed, and
the address of its tracking page **as a template** — so a tracking link is data, not a string built in code. A courier
with no template on file gets no link. `CourierProvider.book()` is the interface a real courier API would land on;
`manualCourier` is the only implementation and is what the platform does today: ops types in the courier and the
number it was given, nothing is sent to anybody. `ops_shipments` now keeps `courier_code`, `tracking_url` and a
`provider` of `manual` or `courier`; only `manual` is ever written today. **Only the manual option is seeded**: no
terms, transit time or tracking address is agreed with a real courier (owner question 24), and none is invented.
`lib/ops/shipping/provider.ts` is folded into `courier.ts`, so there is one courier seam rather than two.

## 7. Customer status emails reuse the platform's one email seam

The sender is the share invites' own `EmailSender` interface and Resend adapter (`lib/share/email.ts`,
`email-server.ts`, decision 0081). Ops owns only the words and the record. **Without all three of
`OPS_EMAIL_PROVIDER`, `OPS_EMAIL_KEY` and `OPS_EMAIL_FROM`, nothing is sent at all**: the record keeps the reason and
ops is shown the words to send by hand. No test and no local run reaches a provider; the keys are never set where
tests run.

**No message states a delivery date.** Every message that would otherwise want one carries
"We are not giving you a delivery date yet: the days for quality checks and the days in transit are not agreed, so any
date would be a guess." The words are written from the order and its status, never typed, so nobody can promise a
date through this form. `ops_customer_emails` keeps the address the message went to, which is personal data: it is
tied to the brand and goes with it on erasure, like every other table of part 2.

## 8. The factory scorecard, and "active only with an approved golden sample"

`buildScorecards` counts, per factory: on-time rate against the date promised, defects in the sample, colour readings
inside the tolerance they were judged by, remakes open and overdue, and the golden sample of every article on file.

- **A rate with nothing behind it is `null`, never 0.** "None yet" and "none wrong" are not the same thing, and a
  factory must not look good because nobody has inspected it. The screen reads "Nothing counted yet".
- **Nothing says whether a defect rate is acceptable.** Owner question 25 is unanswered, so the card shows the rate
  and says so.
- Colour readings with no tolerance on file are counted apart and named, not folded into the pass rate.
- F-O6's rule is the one judgement on the card: a factory is **active only with a golden sample signed off** on at
  least one article (`factory_capabilities.golden_sample_status`, the factory rows' own value). A factory without one
  reads "Not active" and says why.

The screen is `/ops/scorecard`, one nav entry in the ops bar. Its cards stream behind the platform guard through a
`Suspense` boundary rather than a route-level `loading.tsx`, because a `loading.tsx` flushes the shell before the page
runs and `notFound()` can then no longer set a 404 on a platform-only route.

---

## Rights, and what the database really does

Every new table: no browser role writes anything, and every write is a `SECURITY DEFINER` function that only the
service role may run and that checks the actor is a platform admin itself (`private.require_ops_actor`), except
`ops_cut_scheduled`, which has no actor and whose door is the cron secret.

| Table | Who reads it | Writes |
|---|---|---|
| `ops_cut_runs` | platform admins | `ops_cut_scheduled`; append-only |
| `ops_qc_colour_readings` | platform admins | `ops_record_inspection`; append-only |
| `ops_inspection_bookings` | platform admins | `ops_book_inspection`; append-only |
| `ops_commercial_invoices` | platform admins | `ops_issue_commercial_invoice`; append-only |
| `ops_customer_emails` | platform admins | `ops_record_customer_email`; append-only |
| `ops_aql_sample_plans`, `ops_aql_acceptance` | nobody in a browser | the migration's seed |
| `ops_couriers` | nobody in a browser | `ops_set_courier` |

The service role holds `SELECT` only on the five append-only tables, and the database test asserts that a direct
insert is refused. All eight tables are in `tests/integration/isolation.test.ts`'s lists in the existing shape.

## Rule ids

| What | Rule | Why |
|---|---|---|
| AQL sample plans and accept/reject numbers | `R-QC-001` | the rulebook entry that names the level II plan |
| ΔE readings at inspection | `R-SUB-005` | the colour tolerance rule, "factory to confirm the tolerance they can hold" |
| Third-party inspection booking | `R-GAP-000` | no rulebook entry covers third-party inspection |
| Commercial invoice, HS code and origin | `R-GAP-000` | no rulebook entry covers a tariff heading or a customs document |
| Courier terms | `R-GAP-000` | no rulebook entry covers a courier |

Each `R-GAP-000` is listed on the PR, as the plan requires.

## Dependencies

None added. Everything here uses what the repository already has: `zod` (MIT), `@react-pdf/renderer` (MIT, already
used by the factory sheet and the packing list), `@supabase/supabase-js` (MIT) and Node's own `node:crypto`. No SDK
was added for Resend: the adapter is one `fetch` call, as decision 0081 already has it.

## Owner questions

| # | Question | What the platform does meanwhile |
|---|---|---|
| **O1-1** | **ISO 2859-1 level II: can we have a copy, or the factory's own agreed plan?** Every seeded sample size and accept/reject number was typed from the republished table and **nobody has read it against the standard**. | Every row has no source and is marked unsourced; the screen says so, and no row decides whether an order ships. |
| **O1-2** | Is "AQL 0 critical" right as "accept 0, reject 1 at every sample size"? It is not a column of the standard. | Seeded as that, labelled as the spec's own convention. |
| **O1-3** | An ops order names its fabric by the Store's key. Which programme fabric code does each map to, so a ΔE reading can be judged by the right `colour_delta_max`? | A tolerance is used only where the factory holds the same one on every fabric; otherwise the reading is recorded and nothing judges it. |
| **O1-4** | What does a third-party inspection cost, who with, and how long does it take? | The provider is a stub: nothing is booked, no price and no turnaround is shown, and ops is given a reference to quote by hand. |
| **O1-5** | Is 300 pieces the right threshold for offering one? | The spec's 300, seeded as a labelled default setting. |
| **O1-6** | Which HS code does each base article take, from a customs broker? | `base_articles.hs_code`; where it is null the invoice prints the gap instead of a heading. |
| **O1-7** | What terms of delivery (Incoterms) do we sell on? | Empty: the invoice says none is stated. |
| **24** (existing) | Which couriers, and do we want label booking and tracking links through their API? | Only the manual option is seeded; the provider interface is ready for an adapter. |
| **25** (existing, still unanswered) | What defect rate fails a QC check? | One defective piece in the sample still fails the order (decision 0050). The scorecard shows the rate and says no acceptable rate is agreed. |

## What is left

- No real courier, inspection or email adapter. Each is an interface with a deterministic stub or the manual option.
- `CRON_SECRET` has to be set on the deploy before the scheduled cut does anything. It is deliberately off without it.
- No delivery date anywhere, on any screen or document, until QC days and freight days are agreed.
- The AQL rows stay unsourced until someone reads them against ISO 2859-1 (question O1-1).
