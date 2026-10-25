# 0050: Ops console, part 2: quality control, packing, shipping, exceptions and metrics

Status: Accepted locally. The database tests and the end-to-end tests have not run in the sandbox that wrote this (see Evidence).
Date: 2026-10-26
Plan step: platform v4, workstream W2-D. Continues decision 0043.

## Context

Part 1 (0043) takes an order from the Store to a batch, a factory sheet and the factory's own status steps. The spec's ops
table also has quality control, packing, shipping, exceptions and metrics. Same rules as part 1: platform admins only, the
factory never logs in, every write is a function only the server's key may run, history is append-only, and no number is invented.

## Decision

1. **Access and writes** are exactly part 1's. Every page starts with `requirePlatformAdmin()`, every action and route asks the
   database whether the caller is a platform admin, and every SQL function checks the actor again (`private.require_ops_actor`).
   Migration `20261026040000_ops_qc.sql` revokes everything on its six tables from `public, anon, authenticated, service_role`,
   grants `select` to `authenticated, service_role` (platform admins read through a policy; members read none of it), and
   grants `execute` on each function to `service_role` only. No foreign key into another workstream's table: rows name their
   order (part 1's `ops_orders`, which this part builds on) and their brand.
2. **Quality control gate** (`ops_qc_inspections`, append-only). An order is inspected once the factory has marked it ready.
   The checklist has four items (measurements against the size spec on a sample, colour against the swatch, artwork
   placement, names and numbers against the team list), each pass, fail or not inspected, plus a defect count over the pieces
   inspected, photo file ids, and the measurement lines the inspector typed (point, spec, measured, tolerance, in mm).
   **The result is not typed: it is worked out**, in SQL and in `lib/ops/qc/checklist.ts` (the integration test holds the two to
   each other): pass only when all four items pass, at least one measurement is recorded and each is within the tolerance
   the inspector typed, and no inspected piece is defective. A new inspection never replaces an old one; the latest decides.
   A fail needs the pieces to make again (by size), an owner and a due date, and opens a **remake line** (an exception of kind
   remake) in the same step. Defect rate per factory is defective pieces over pieces inspected, grouped by the factory copied
   onto each inspection.
3. **Shipping** (`ops_shipments`, append-only). A parcel is recorded by hand: courier, tracking number, day sent, pieces by
   size. `ops_record_shipment` refuses unless the order is `ready` and its **latest inspection is a pass** (`qc_not_passed`), and
   refuses more pieces of a size than the order still owes (`over_shipped`). A parcel that leaves pieces behind needs an owner and
   a due date and opens a partial-shipment exception. **No courier is called**: `lib/ops/shipping/provider.ts` defines the
   interface and the only implementation, `manual`, which returns what was typed and invents no tracking link.
   **"Shipped" is derived**, not a value of `ops_orders.status`: an order is shipped when its parcels cover its pieces
   (`fulfilmentOf`). Changing the status list would have edited part 1's table, status code and screens, which this
   workstream does not own; the order keeps the status the factory set (`ready`). If the owner prefers a `shipped` status, it is
   one constraint, one event kind and `lib/ops/status.ts`.
4. **Packing** (`ops_pack_bags`, `ops_cartons`). Bags are made from the order's team list: one bag per line, in list order, holding
   that line's pieces; with no list (none, or erased), one bag per size. **Bags store no name**: only the position of the line
   in the team list, a size and a count. The label is built when the packing list is printed, reading the name and number from the
   team list, so erasing a team list still erases the names (the label then says the player is not on the list). Cartons hold a
   weight in grams and a length, width and height in millimetres **as typed by ops; an empty box is null and prints "Not set"**.
   The packing list is an A4 PDF (`/api/ops/orders/<id>/packing-list`, react-pdf, the Geist font, fixed dates, same bytes for
   the same list; its SHA-256 for the sample is recorded in `lib/ops/packing/pdf.test.ts`). Warnings on the list: pieces in
   bags differing from the order, cartons with weight or size not set, bags not packed, a team list that is gone.
5. **Exceptions** (`ops_exceptions` and append-only `ops_exception_events`): remake, partial shipment, lost parcel, size swap. Each has an
   owner (a name, so a factory contact can own one) and a due date, both required. Owner and date can change (a history line each time) and
   an open exception is resolved once, with a reason. Overdue means open and past its due date.
6. **Metrics** on `/ops`, computed in `lib/ops/metrics/compute.ts` from the tables and nothing else: orders this week (since Monday 00:00 UTC),
   pieces in production (received or in production), on-time rate against the promise (shipped orders with a promised date; the date of the last
   parcel against the promised date; orders shipped with no promised date are counted apart; "Not enough data" when there is nothing to judge), defect rate by factory,
   remakes open (and overdue), value of orders in open batches by currency as the Store gave it (orders with no value are counted, not guessed), next cut-off.
   A table past 5,000 rows makes the screen say its numbers cover the newest only.
7. **Erasure.** None of the six tables holds a player's name. Their free-text notes could still name someone, so each is tied to its
   brand with `on delete cascade` and listed in `lib/deletion/team-data.ts` (a test fails if a table of this migration is not listed). The append-only tables
   refuse update and delete, except that a delete is allowed once the brand row is gone, which is how account erasure reaches them
   (`private.ops_qc_refuse_change`). Truncate is refused. Ops notes carry a hint: do not put a player's name in a note.

## Evidence

- **Ran:** unit tests for every rule (checklist evaluation including tolerance edges, the text parsers, exception rules, shipping
  rules and blockers, the manual provider, bag planning, packing list model, the packing PDF and its recorded hash, every metric),
  service tests over fakes, the architecture tests (ops access now covers the four new action files and the packing list route;
  the font is traced for it), the wording test, and the deletion registry test. Coverage of `lib/ops` is above the 90% mark.
- **Ran against a bare PostgreSQL 16 with stub tables** (no Docker in the sandbox): the migration applied after part 1's; a script
  covered inspection before ready, fail without a remake, fail with a remake, out of tolerance, pass, shipping before a pass and after
  a fail, partial shipment without an owner, over-shipping, completing an order, bags, cartons with nulls, packing a bag and then refusing to
  remake bags, update, delete and truncate refusals, exception history, a non-admin actor, and **a brand delete cascading through the append-only tables**.
- **Written, NOT run:** `tests/integration/ops-qc.test.ts`, the six new entries in `tests/integration/isolation.test.ts`, and
  `e2e/ops-qc.spec.ts`. CI runs them; a failure there is a test or fixture mistake to fix, not evidence about the design.
- **Not verified in a browser:** the pages and forms (typecheck, lint pass; I did not see them rendered) and the packing PDF on a deployment.

## Alternatives

- **A `shipped` status on `ops_orders`.** Rejected here (see 3).
- **Storing player names on bags.** Rejected: names would outlive the team list.
- **Letting the inspector type the result.** Rejected: a typed pass beside an out-of-tolerance measurement is exactly the error the gate exists to stop.
- **A courier API.** Not built: the owner has not decided.

## Consequences

- Members cannot see QC, packing, exceptions or tracking numbers. Showing a tracking number to a brand is one policy and a screen (Q5).
- Measurement lines are typed as text, one per line. A structured grid per article needs the size spec, which the platform does not hold for ops.
- The shared files touched, a line or so each: `tests/architecture/ops-access.test.ts`, `tests/integration/isolation.test.ts` (six entries),
  `lib/deletion/team-data.ts` and its test, `next.config.ts` (font tracing), and part 1's page, layout and order page (links, metrics, an exception form).

## Owner questions

- **Q1. Measurement tolerances.** Who supplies the points of measure and tolerance per article? Today the inspector types spec, measured and tolerance on every line.
- **Q2. Acceptable defect rate.** The default is zero: one defective piece in the sample fails the order. Labelled "Knitwright default, not agreed with a factory". What limit has each factory agreed, and what sample size?
- **Q3. Remakes.** Who tells the factory about a remake line (it is on screen only), and does a remake order get its own reference?
- **Q4. Couriers.** Which courier or couriers, and do you want label booking and tracking links through their API? Until then parcels are typed in.
- **Q5. Tracking for brands.** Should a club or brand see its tracking number and shipped date? Delivery address and parcel weight rules?
- **Q6. A `shipped` status.** Should `ops_orders.status` gain `shipped` (and the part 1 screens with it)?
- **Q7. Packing.** Packing rules per factory (bag per player, carton limits). The sheet text is still the part 1 default.
- **Q8. Photo storage.** QC photos are referenced by file id only; which bucket and who uploads them?
