# 0062: Brand workspace, product list and brand runs (W4-C)

Status: Proposed
Date: 2026-10-25
Plan step: platform-v4 W4-C

## Context

The spec says a small brand's workspace works like a club's, with the brand kit and a product list instead of rosters. A brand
run is 50 to 300 pieces. It takes a size breakdown instead of a roster, offers a paid sample first, and prices by quantity.
A brand is already a `brands` row with roles (decision 0042). The one door into production is
`submit_order_for_production` (decision 0043). The factory profile (V1) holds a minimum order and a price ladder per factory,
both "not set" until the owner sets them in the settings console (decision 0056).

## Decision

1. **A product is a design a brand lists.** Table `brand_products`: one per design, a name, a stage (`idea`, `sample`, `run`) and
   the design version in use. It goes with its design or brand. The page is `/brand`, linked from the studio navigation next
   to Club. Members read it; owners, admins and kit managers change it (the club rule `manageKit`); viewers look only.
2. **A run is a size breakdown, a release and an order.** Table `brand_runs` (append-only): kind `sample` or `run`, the frozen
   release it was made from, the sizes (`{"M": 10}`), the pieces, the notes the app flagged, and the ops order id it became. A
   sample is "a release like any other": the brand freezes a release from the design as for any order and links it here. The
   function checks that the release belongs to the product's design in the same brand.
3. **Handing over to ops uses only the documented contract.** `public.submit_brand_run` calls
   `public.submit_order_for_production(release, 'brand-run:<brand>:<request key>', factory profile, fabric, article, sizes)`
   inside one transaction and writes the run and a history line. The article is read from the design, never sent by the
   browser. The factory profile id comes from the loaded profile (`knitwright-default` until the owner adds factories). No price or
   value is passed: the contract's `p_value_minor` and `p_currency` stay null. Ops code and tables are not changed.
   A retry with the same request key answers with the order already sent (`created = false`), so a double press is one order.
4. **Stages only move forward and only when the brand says so.** `idea` to `sample` needs a sample order already sent;
   `sample` to `run` is the brand's own press ("Happy with the sample, move to run stage"). A sample may be ordered until the
   product is at `run`; a run only at `run`. The database enforces all of it (`confirm_brand_product_stage`,
   `submit_brand_run`); `lib/brand-runs/stage.ts` mirrors it for the screen. Every move is a line in `brand_product_events`
   (append-only). The product's `design_version` follows the release most recently ordered.
5. **Breakdown checks live in `lib/brand-runs/breakdown.ts`.** Sizes must be in the design's size run (when it has one),
   whole pieces, and a sample is exactly one piece of each size chosen. A run is **flagged, not refused**, when it is under
   the factory's minimum for the garment, or over 300 pieces; when no minimum is set, the flag says so. A flagged order is sent
   only after the brand ticks that it read the notes, and the notes are stored with the run. 300 is the spec's upper bound
   for a brand run and is a constant (`MAX_RUN_PIECES`), not a factory term.
6. **Prices are never invented.** The quote line reads the factory profile's price ladder. With no ladder, or a quantity below the
   first step, the screen says "Knitwright will quote". A ladder step is shown as "<price> per piece from <n> pieces, from the
   factory's price ladder" with no currency, because the ladder carries none. A sample has no price here at all. **The platform
   takes no payment**: "paid sample" is a commercial term for the Store and for Knitwright's quote; nothing here charges, holds or
   records a payment, and no credits are spent (credits are for outputs, decision 0044).
7. **Server only writes.** Tables are brand-scoped, row level security on, members read their brand's rows, the browser role has
   SELECT only, and the service role holds SELECT only on the tables too: every write is one of three SECURITY DEFINER
   functions (`create_brand_product`, `submit_brand_run`, `confirm_brand_product_stage`) that only `service_role` may run and that
   check the caller's role themselves. Screens call server actions (`lib/brand-runs/actions.ts`, `defineAction`, rate limit
   `clubWrite`); brand and person come from the session.
8. **Erasure.** Rows hold no personal data (no names, no roster). They go with their design or brand through
   `on delete cascade`; the append-only triggers let the delete through only once the product is gone. The ops order a run
   became is ops' record and is not touched.

## Evidence

| Claim | Test |
|---|---|
| Breakdown validation, MOQ and 300 flags, "not set" minimum | `lib/brand-runs/breakdown.test.ts` |
| Price ladder lookup and "Knitwright will quote" | `lib/brand-runs/quote.test.ts` |
| Sample to run transition rules | `lib/brand-runs/stage.test.ts` |
| Ordering: role, stage, flags need acknowledgement, factory from profile | `lib/brand-runs/place-order.test.ts` |
| Nothing on the screens reads as settled, no price of our own | `lib/brand-runs/wording.test.ts` |
| RLS across two brands, role checks, contract use, idempotent retry, stage rules, append-only, cascade | `tests/integration/brand-runs.test.ts` |
| Browsers can read and cannot write the three tables | `tests/integration/isolation.test.ts` |
| Create a product, size breakdown, sample, run, ops queue | `e2e/brand-runs.spec.ts` |

What ran in the cloud sandbox (no Docker): the unit tests, typecheck and lint. The migration was also applied to a bare PostgreSQL 16
after the repository's earlier migrations (with stand-ins for Supabase's `auth` and `storage` schemas, whose three oldest
migrations error there for that reason) and the three functions were driven by hand: product listing, viewer refusal, run
refused at idea, a sample of 2 pieces refused, sample sent and retried (one order), other brand refused, stage steps in and out of
order, run at the run stage, history lines, append-only refusal for the table owner and for `service_role`, and design deletion
cascading to all three tables. `tests/integration/brand-runs.test.ts`, the isolation additions and the e2e spec were written
without being run; CI runs them.

## Alternatives

- **A new `brands` kind for small brands.** Rejected: a brand is already the account (decision 0042).
- **Stage as a column on `production_releases`.** Rejected: releases are frozen forever.
- **Refusing a run under the minimum.** Rejected: the minimum is the factory's term and may be negotiable; the plan asks to flag.
- **Passing a value to the contract for the quoted price.** Rejected: no price is set anywhere, and the platform never sets one.
- **A foreign key from `brand_runs.order_id` to `ops_orders`.** Rejected: no keys into other workstreams' tables.

## Consequences

- `lib/brand-runs` is held to the 90% coverage mark. `lib/deletion/team-data.ts` was not edited: the new tables hold no names.
- A brand without a frozen release cannot order; the builder says so and points to the design.
- The fabric is typed by the brand while the factory profile lists none (the default profile has none).
- Brand runs go to ops as an ordinary order; ops will see `external_ref` beginning `brand-run:`.

## Owner questions

- **B1. Paid sample.** How is a sample charged (Knitwright quote, invoice, or the Store)? Nothing here takes payment.
- **B2. Minimum order per garment and price ladder.** Still "not set" until the settings console is filled (decision 0056, questions 4 and 5).
- **B3. Factories and fabrics.** The run uses the `knitwright-default` profile and a typed fabric. Which factory makes brand runs, and with which fabrics?
- **B4. Upper limit.** Is 300 a hard limit for brand runs? It is flagged today, not refused.
- **B5. Who confirms a sample?** Today any owner, admin or kit manager presses "Happy with the sample". Should a named person and date be recorded as for sign-offs?
