# 0080: Make — product created, samples, golden samples and the order modal (Y7)

Status: Proposed
Date: 2026-10-30
Plan step: platform-v5 Y7 (F-S7)

## Context

F-S7 is everything between a validated design and a factory making it: the "product created" hand-off page, a sample of
one piece per size, the golden sample the founder signs off, and the order modal that turns products and sizes into an
order. The spec ends three of those flows in "Checkout" and a payment schedule.

Owner decision 1 removes that ending: **the Store stays separate and this workstream takes no money.** Everything here
stops at the price, the delivery date and the hand-off into production through `public.submit_order_for_production`
(decision 0043).

Two things already exist and are built on rather than around:

* `brand_products`, `brand_runs` and `submit_brand_run` (decision 0062): a product with a stage, a sample or a run as a
  size breakdown, the frozen release it was made from and the ops order it became. `submit_brand_run` is the only code
  that calls `submit_order_for_production` for a brand, and this workstream does not change it or call the contract
  itself.
* The factory model as data (decision 0071): price tiers, lead times, the Class A cut-off, QC days, freight days and
  country rules, with "not set" where nobody has agreed a figure.

## Decision

1. **The make pages live under the design.** `/studio/[projectId]/make` is the product-created hand-off,
   `/make/sample` the sample request, `/make/golden-sample` the golden sample, `/make/order` the order modal. Each page
   checks the member itself (`requireMember`). The editor page is Y2's and is not touched, so the "Save product" link
   into `/make` is Y2's to add; until it does, the pages are reached by address and from each other.
2. **No money, anywhere.** There is no cart, no checkout, no payment, no deposit schedule and no payout. "Connect your
   store & publish" is a link out that says *Handled by the Knitwright Store*; it does not publish anything. Every flow
   that the spec ends in "pay" ends here in the price, the delivery date and a hand-off button. The spec's
   "40% deposit + 60% before shipping" is recorded as the Store's, not built.
3. **A golden sample is evidence, not a status flag.** `golden_samples` holds the version it was cut from, the sample
   run it came from, the factory, the founder's fit and colour ratings (1 to 5), who signed it off and when. Its
   evidence lives in three append-only tables: `golden_sample_photos`, `golden_sample_poms` (a measured point of
   measure in whole millimetres against the target and tolerance it was judged by) and
   `golden_sample_colour_readings` (a Delta-E reading with the two Lab values it was computed from, the instrument and
   the observer). Nothing may be inserted against a golden sample that is already signed off, and no row of those three
   tables can ever be changed or removed: that is what makes it evidence. Asking for changes closes the golden sample
   (`changes_requested`) and the next draft of the design starts a new one.
4. **A sign-off carries its evidence and moves the product on.** `sign_off_golden_sample` refuses a sign-off with
   no photo (`needs_photo`) and with nothing measured (`needs_measurement`), because a sign-off with nothing behind
   it is only an opinion; a Delta-E reading is not required, since a brand may have no colour report. Signing off
   also moves the product `idea` to `sample` to `run` through `confirm_brand_product_stage` (decision 0062), which
   is what makes a run possible at all: the founder's sign-off is the same act as the brand workspace's "happy with
   the sample". A photo is a picture the brand already holds (`public.files`), kept as a plain id rather than a key,
   so removing the picture later cannot force a change to an evidence row.
5. **A run needs a signed-off golden sample of the version being made.** `submit_make_order` refuses a run
   (`golden_sample_required`) unless a signed-off golden sample exists for the release's design version, or a recorded
   carry-over brings one forward from a parent version. A carry-over is written by `carry_over_golden_sample`, which
   refuses any changed field the server did not label `surface`; the server labels fields with
   `lib/make/surface.ts`, which classifies every top-level field of the design and treats an unknown field as
   structural. The carry-over row keeps the list of changed fields, so why a run was allowed can be read back.
   A carried-over sign-off always carries the note that the colour readings were taken on the parent's own colours.
6. **A sample is one piece per size, at most three sizes.** Checked in `lib/make/sample.ts` for the screen and again in
   `submit_make_order`, which refuses more than three (`sample_sizes`). `submit_brand_run` already refuses anything
   other than one piece per size.
7. **Class B is 50 to 300 pieces per style.** The class comes from the base article (decision 0066), looked up through
   the design's garment type. Where the class is known, `submit_make_order` **notes** a Class B run outside that range
   (`class_b_quantity`) on the order's flags and `lib/make/run.ts` says the same thing on the screen before the press.
   It was shipped as a refusal and the orchestrator changed it to a flag in migration
   `20261110040000_class_b_flag.sql`: a refusal would assert that a factory will not cut 400 of a style and none has
   said so, so this matches the brand-run builder of decision 0062, rule 5. Class A is any
   quantity from one piece. Where no base article covers the garment type the class is "not set", no range is applied,
   and the screen says the class is not set rather than guessing it.
8. **Every price is X6's row, labelled.** `lib/make/prices.ts` reads the price tiers for 1, 50 and 100 pieces through
   `priceFor`, and shows each as the tier's own label — the seed's is "Placeholder club price from the build pack, not
   a factory quote". A quantity below the smallest tier is shown as "no tier covers it", never as a price. Money is
   integer minor units and a currency everywhere; the only formatting is `formatMoney` (decision 0071). The order modal
   prices a basket with the tier read across every piece in it (spec F-T5), through `priceBasket`.
9. **No delivery date is promised.** `lib/make/delivery.ts` shows exactly what `promisedDate` (decision 0071) answers.
   The seed has no QC days and no freight days, so today every date reads "not set" and names what is missing. The
   "Ready by" chip of the order modal filters only on dates the factory data can actually produce; with none, it says
   so and selects nothing.
10. **Server only writes, through functions.** The five tables are brand-scoped with row level security; members read
   their own brand's rows, the browser role holds SELECT only, and so does the service role. Every write is a
   SECURITY DEFINER function only `service_role` may run, which checks the caller's role (`can_manage_kit`, the club
   rule, as decision 0062 does). Screens call server actions (`defineAction`, rate limit `clubWrite`); the brand and
   the person always come from the session.
11. **The hand-off keeps the existing factory profile id.** Prices, lead times and dates come from X6's factory rows;
    the id passed to `submit_order_for_production` stays the one the existing factory profile gives
    (`knitwright-default` until the owner adds factories), as decision 0062 passes it, so ops batching is unchanged.
    Joining the two ideas of "factory" is wiring the orchestrator owns, not this workstream's to change.

## Rule ids

No rulebook entry covers a golden sample, a sample size count, the Class B range, a carry-over or a delivery date, so
every finding this workstream raises carries `R-GAP-000` and is listed in the pull request comment.

## Evidence

| Claim | Test |
|---|---|
| A sample is 1 to 3 sizes, one piece each, from the design's size run | `lib/make/sample.test.ts` |
| Class B 50 to 300 noted not refused, Class A from 1, class not set applies no range | `lib/make/run.test.ts` |
| Surface and structural fields, unknown field is structural | `lib/make/surface.test.ts` |
| A run needs a sign-off of the version, or a surface-only carry-over | `lib/make/gate.test.ts` |
| Price at 1, 50 and 100 from the tiers, below the smallest tier is not a price | `lib/make/prices.test.ts` |
| A date is shown only when every part is set, and says what is missing otherwise | `lib/make/delivery.test.ts` |
| The order modal's search, chips, tier recalculation and total | `lib/make/order-modal.test.ts` |
| A measurement judged against its tolerance, and a reading against the factory's limit | `lib/make/judge.test.ts` |
| The summary, the carry-over annotation and the whole context | `lib/make/context.test.ts` |
| Every write sends the brand and the person from the session, and each refusal becomes the right failure | `lib/make/service.test.ts` |
| What the pages may send, and the market a price is shown in | `lib/make/schemas.test.ts`, `lib/make/market.test.ts` |
| The journey from a sample to a signed-off golden sample to a run | `e2e/make.spec.ts` |
| Nothing reads as settled, and no price or date is written in the source | `lib/make/wording.test.ts` |
| The database refuses a run with no sign-off, a fourth sample size, evidence on a signed-off sample, and every direct write, and flags a Class B run out of range | `tests/integration/golden-samples.test.ts` |
| The tables are invisible to another brand and unwritable by a browser | `tests/integration/isolation.test.ts` |

## Owner questions

Recorded in the pull request comment.
