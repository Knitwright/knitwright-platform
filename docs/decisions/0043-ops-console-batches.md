# 0043: Ops console, part 1: orders in production, weekly batches, factory sheet and status

Status: Accepted locally. The database tests and the end-to-end test have not run in the sandbox that wrote this (see Evidence).
Date: 2026-10-24
Plan step: platform v4, workstream V5

## Context

The spec asks for an internal console on the same database. The factory never logs in. Part 1 covers the weekly
batch cut-off, the factory sheet and factory status. The platform has no payment concept: the owner's separate Store
will tell the platform when an order should be made. QC, packing, shipping, exceptions and metrics are wave 2.

## Decision

1. **Access.** `/ops` is the route group `app/(ops)/ops`. Only platform admins (`platform_admins`) open it; everyone else,
   signed in or not, gets the page that does not exist. Every page and the layout starts with `requirePlatformAdmin()`
   (the architecture check for the admin group now covers `app/(ops)/` too). Every route and action asks the database
   whether the caller is a platform admin (`assertPlatformAdmin`) and every database function checks the actor again.
   Nothing in the public shell or the studio links to `/ops` (tested).
2. **Tables** (migration `20261025050000_ops_batches.sql`): `ops_settings` (one row), `batches`, `ops_orders`,
   `ops_order_events`. No foreign key into another workstream's table: an order names its release by id and keeps a small
   snapshot (label, number, roster hash, file count), and names its factory by a text id. `ops_orders` holds sizes and
   counts only; player names stay in `team_order_rows` and are read when a sheet is made, so erasing a team list still
   erases the names (the sheet then says the list is gone).
   Row level security: platform admins read all four; a member reads their own brand's orders and history; batches and
   settings are admin-only; no browser role writes anything. All writes are functions only the server's key may run.
3. **Status history is append-only.** `ops_order_events` cannot be updated, deleted or truncated, even by the server's key.
   The current status on the order is a convenience copy; the events are the record. An event carries the actor (null when the Store submitted).
4. **The weekly cut-off** is a setting (`ops_settings`: weekday, time in UTC, lead time in days). The seeded row is
   labelled "Knitwright default, not agreed with a factory": Friday 17:00 UTC, **lead time not set**. The next cut-off for
   an order is the next weekly cut-off at or after the moment it is submitted (an order at exactly the cut-off is in that
   batch). `private.next_cutoff` (SQL) and `lib/ops/cutoff.ts` do the same sum and the db test holds them to each other.
5. **Promised date** = the cut-off date plus the lead time, fixed when the order is submitted. While no lead time is set
   it is **null** and the console says "Not set"; no date is invented. Changing the settings does not move orders already
   submitted. A delay (below) is the only way a date moves after that.
6. **Batches.** `ops_cut_batches` puts every waiting order whose cut-off has come into a batch, one batch per factory,
   fabric, article and cut-off, and makes the batch if needed. It is run from a button ("Cut batches now"); see O4.
   Ops can **hold** an order (out of any batch, only before the factory has it), take it off hold (it waits for the next cut),
   and **move** it to another batch of the same factory, fabric and article. A move to a batch for something else is refused.
7. **Factory status**: batched, received, in production, ready: one step forward at a time, never back (SQL and
   `lib/ops/status.ts` agree). A **delay** moves the promised date later (never earlier or equal) and needs a reason, and is
   an event with the new date and the reason.
8. **Factory sheet**: one A4 PDF per batch (`@react-pdf/renderer`, the Geist font, as decision 0008; fixed dates, no random
   ids, so the same batch gives the same bytes): order list, pieces by size per order and in total, fabric and trims, name
   and number list per order, packing instructions, due date. A **sample batch's SHA-256 is recorded in
   `lib/ops/factory-sheet/pdf.test.ts`**. The fabric quantity and the trim list are **"Not set"** with the reason (no cut plan,
   no trim list in the platform); the packing text is labelled a Knitwright default. If a team list and the order disagree on
   pieces, the sheet says so at the top.
9. **Print files ZIP** for the batch: one folder per order, the files **built again** from each release's frozen file specs
   with the same builder the print download uses, and a `manifest.csv` (reusing `lib/print/build/package.ts`). Each line
   says "differs from the release" if the rebuilt hash is not the one frozen with the release, or "not in the release". The
   release stores hashes, not files, so this rebuild is how the files exist at all; ops must not print a line that says it differs.

## The contract with the Store: `public.submit_order_for_production`

The one door into production. Only the server's own key (`service_role`) may run it. Typed wrapper and tests:
`lib/ops/contract.ts`, `lib/ops/contract.test.ts`, `tests/integration/ops-batches.test.ts`.

```
submit_order_for_production(
  p_release_id         uuid,        -- a frozen release (production_releases)
  p_external_ref       text,        -- the Store's order reference, 1..120 chars
  p_factory_profile_id text,        -- which factory, as a text id
  p_fabric_key         text,        -- which fabric, as a text id
  p_article_id         text,        -- the garment article, e.g. 'team-jersey'
  p_sizes              jsonb,       -- {"M": 10, "L": 5}: 1..40 sizes, label 1..16 chars, 1..99999 pieces each
  p_value_minor        bigint = null,  -- optional: the Store's price in minor units ...
  p_currency           text   = null   -- ... with its ISO code, A-Z x3. Both or neither.
) returns table (order_id uuid, status text, cutoff_at timestamptz, promised_on date, lead_time_days integer, created boolean)
```

- The brand, design, roster hash and file count are **read from the release**, never from the caller.
- **Idempotent on `p_external_ref`**: same reference and same release returns the existing order with `created = false`
  and writes nothing. Same reference with another release raises `external_ref_conflict`.
- A new order starts `submitted` (waiting for the next cut), with `cutoff_at` = the next weekly cut-off and `promised_on` =
  cut-off date + lead time, or null while no lead time is set. One `submitted` event is written.
- Refusals are Postgres errors with a `hint`: `release_not_found` (P0002), `external_ref_conflict` (P0001), `invalid_sizes`
  and `invalid_value` and `invalid_input` (22023). Nothing is written on a refusal.
- The platform never sets a price. `sizes` is what the Store says; the platform does not check it against the team list, but the
  factory sheet warns if the two disagree.
- Nothing about payment is stored or implied. "Submitted" means "the Store asked for this to be made".

## Evidence

What ran, and what did not:

- **Ran:** the unit tests in `lib/ops` (cut-off maths including a property test over 20 years of dates, grouping, status
  rules, delay rules, contract, services over fakes, factory sheet content, the PDF read back with `pdfjs-dist`, determinism,
  the recorded hash, the zip), the architecture tests (`tests/architecture/ops-access.test.ts`: page guards, route and action
  admin checks, no public link, font tracing), the wording test.
- **Ran against a bare PostgreSQL 16 with stub tables** (the sandbox has no Docker, so `pnpm db:start` could not run): the whole
  migration applied cleanly, and a script exercised the Store contract (create, retry, conflict, bad sizes, bad value, missing
  release), the cut-off sum at the edges, cutting batches, hold, release from hold, move (and the mismatch refusal), the
  status steps (and the skipped-step refusal), delays (later only, reason needed), append-only history (update, delete and
  truncate refused), and row level security (a member sees their own orders and history only, no batches or settings; a
  stranger sees nothing; browsers cannot write or run the functions). The stubs stand in for `auth.users`, `platform_admins`,
  `memberships`, `production_releases` and the two `private` helpers; they are not the real definitions.
- **Written but NOT run:** `tests/integration/ops-batches.test.ts` (needs the Supabase stack) and `e2e/ops.spec.ts`.
  CI runs them; if either fails there it is a test or fixture mistake to fix, not evidence about the design.
- **Not verified in a browser or on a deployment:** the pages and forms (typecheck, lint and build pass; I did not see them
  rendered), the font tracing for the two new download routes on the host (decision 0008's deployed check still applies to them),
  and the print-files ZIP against a real design (the unit test uses a fake builder; the e2e uses a release with no files).

## Alternatives

- **A column on `production_releases` for the order status.** Rejected: releases are frozen forever by design.
- **A payment status on the order.** Rejected: the platform has no payment concept; the Store owns that.
- **Storing player names on the order.** Rejected: personal data would then outlive the team list.
- **A foreign key from `ops_orders` to a factory profile table.** Rejected until V1's `factory_profiles` has merged; the text id carries over.
- **Cutting batches by a database cron.** Not done: the project has no scheduler yet (O4).

## Consequences

- The Store's author needs only the function above and the key. They get a promised date back only once a lead time is set.
- A batch has no "sent to the factory" state yet. Ops can still hold or move an order up to the moment the factory marks it received.
- The cut-off is UTC only; a local-time cut-off needs a time zone column and the same sum in both places (O1).
- `lib/ops` is held to the 90% coverage mark like the other production directories.
- Shared files touched, one line or so each: `tests/architecture/page-guard-check.ts` (admin group list), `vitest.config.mts` ("ops" in the 90% list),
  `next.config.ts` (font tracing for the two download routes).

## Owner questions

- **O1. Cut-off weekday, time and time zone.** Seeded as Friday 17:00 UTC, a placeholder. Which weekday and time, and in which zone?
- **O2. Lead time** per factory and per article. Seeded as **not set**, so no order has a promised date. What lead time has each factory agreed?
- **O3. Which factory makes which article** (and with which fabric)? The Store passes `factory_profile_id` and `fabric_key` as text; they should become V1's factory profile ids.
- **O4. Who cuts the batches, and when?** Now a button. Should it be a scheduled job at the cut-off, and who is told?
- **O5. Packing instructions** per factory. The sheet carries a labelled default.
- **O6. Fabric quantity and trims.** What should the sheet say (metres per piece? a trim list per article?). Both are "Not set" now.
- **O7. Does the factory receive the sheet by email, a shared link, or a person sends it?** Nothing is sent from the platform.
- **O8. Delays**: should the brand or club see the new date and the reason? Members can read the events of their brand's orders, but no screen shows them yet.
- **O9. Value and currency**: does the Store always send them, and in which currency? Ops sees only what the Store gave.
