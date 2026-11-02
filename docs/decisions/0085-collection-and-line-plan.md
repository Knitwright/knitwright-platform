# 0085: The collection plan and the line plan (Z4)

Status: Proposed; every freight figure and the duty basis are labelled placeholders, owner questions listed
Date: 2026-10-30
Plan step: platform-v5 Z4 (F-S10)

## Context

F-S10 is the first screen in the platform where a founder plans a *range* rather than a product: a board of style
cards in named frames, and a line plan table that puts a cost and a margin against every line. The spec connects it
to "Knitwright's actual price tiers", and its acceptance tests are exact:

* changing a quantity re-prices the line from the current tiers, live;
* the totals match the checkout of the same basket **to the penny**.

Owner decision 1 removes the checkout: the Store stays separate and this workstream takes no money. So "to the penny"
is read against the thing the platform actually has — `priceFor` and `priceBasket` over the `price_tiers` rows of
decision 0071 — and the spec's second action, **Create drop**, exports a payload for the Store to collect rather than
opening anything.

Three things already existed and are built on rather than around:

* the factory model as data (decision 0071): `price_tiers` counted across the whole basket, `country_rules` with duty
  by HS code and freight **days**, and "not set" wherever nobody has agreed a figure;
* the base article catalogue (decision 0066), which holds the HS code a duty rate is read by;
* `brand_products`, `brand_runs` and the make flow's one door (decisions 0062 and 0080), which is how a sample is
  ordered — this workstream adds no second way to reach production.

## Decision

1. **A style card is one style in one colourway.** So the spec's three counters have exact meanings, and a test holds
   them: **Styles** is how many style *names* the cards hold, **Style-colourways** is how many cards there are, and
   **SKUs** is how many name–colourway–size rows carry at least one piece. A size planned at zero is not a SKU,
   because nobody can buy it.
2. **A style's quantity is the sum of its size rows.** `collection_style_sizes` holds the pieces per size and the
   style has no quantity column, so a plan can never show a total its own size rows do not add up to. The size rows
   have no stored order; they are read in size-run order with the existing `orderSizes`, never alphabetically.
3. **Unit cost is the tier price, plus freight, plus duty, in that order.** `landedCost` takes the tier part from
   `priceFor` untouched, with the tier read at the **whole plan's** quantity (spec F-T5: tiers count across the
   basket), then adds the destination's freight per piece and duty on the basis the freight row names. Rounding
   happens once, per piece, as it does in `priceFor`, so a unit price times a quantity is exact in minor units and a
   line can never disagree with the footer.
4. **The footer reports two cost totals, and the tier one is the penny test.** `tierCostMinor` is the sum of the tier
   lines and nothing else, so it equals `priceBasket` of the same pieces exactly — asserted at 10, 19, 20, 49, 50 and
   120 pieces and across the tier boundaries in `lib/collections/line-plan.test.ts`. `landedCostMinor` is that total
   plus the freight and duty each row carries, and the screen says which is which.
5. **Freight cost is a new row, because nothing held one.** `country_rules` has freight *days* and a duty rate by HS
   code; it has no freight *cost*. `collection_freight_rates` adds the per-piece freight to a destination and the
   basis duty is charged on (`goods` or `goods_and_freight`), as platform data every signed-in member may read and
   only the server may write. **Both seeded rows are labelled placeholders** — "Placeholder freight, not a carrier
   quote" — and the line plan prints that label beside every landed cost. Neither figure came from a carrier or a
   customs adviser, and the owner questions below ask for both.
6. **A missing rate is a sentence, never a zero.** No freight row, a freight row in another currency, an article with
   no HS code, or no duty rate for that HS code: in each case nothing is added and the plan says what is not on file.
   The platform never converts a currency it has no rate for, and never assumes a duty rate it has not been given.
7. **A margin is only shown where both sides are known.** Revenue is the wholesale units at the wholesale price plus
   the D2C units at the RRP; units are whole pieces and the remainder of the split goes to D2C. Where a price those
   units need is unset, or where the cost is unknown, the revenue, the profit and the margin are null and read "—".
   The footer's toggle is the spec's own sentence, "Assumes full-price sell-through"; turning it off hides revenue,
   profit and margin rather than discounting them, because no sell-through rate is on file (`R-GAP-000`).
8. **"Create drop" writes a payload and nothing else.** `export_collection_drop` records an append-only payload per
   plan, versioned 1, 2, 3 for that plan: the styles with their sizes as *targets*, the prices the plan carries, the
   landed unit cost, the counters, the sell-through assumption and the labels of every row the money came from. No
   storefront, no cart, no checkout, no payment, no payout — in the schema, in the payload, or in any sentence of it.
   A test scans every key and every string of a payload for those words and fails on one.
9. **"Order samples for all approved styles" goes through Y7's door.** `lib/collections/samples.ts` decides only
   which approved styles can be sampled and with which sizes (one piece per size, at most three, the first three
   planned); the order itself is `submit_make_order` with its own request key per style, so a second press sends
   nothing twice. A style that cannot be sampled — not listed as a product, nothing planned — comes back with the
   reason and its rule id; it is never silently skipped.
10. **One currency per plan, named on the plan.** A collection carries its destination and its currency (GBP or AUD,
    spec F-S8), and every money column in these tables is in the minor units of that currency. A plan can only be
    landed in a market whose `country_rules` row is open for selling, which the database checks itself
    (`destination_closed`).
11. **Nobody writes these tables directly.** Six SECURITY DEFINER functions — `create_collection`,
    `save_collection_frame`, `save_collection_style`, `remove_collection_style`, `remove_collection`,
    `export_collection_drop` — each check `private.can_manage_kit` themselves and are callable by `service_role`
    only. Members hold SELECT on their own brand's rows through row level security; the server's own key holds SELECT
    too, so a direct update or delete answers "permission denied" before any trigger runs.
12. **Removing a plan takes its payloads with it.** As a brand product's runs go with the product (decision 0062): a
    payload records the hand-over of a plan, and a plan nobody kept is a plan nobody handed over.
13. **The board scrolls; it does not pan.** The canvas is a dotted, scrollable region with the frames laid out in it,
    rather than a drag-panned surface. The x and y of a frame and a card are stored, so a later workstream can make
    the canvas draggable without a migration; a scrollable region works today with a keyboard, a screen reader and a
    phone, which a drag surface does not.
14. **The totals panel says what it cannot count.** The spec asks for Colours beside Colourways. A plan holds the
    colourway *names* typed on the cards, not a colour list, so the panel shows those names and says a colour
    breakdown would come from each design's own colours, which the board does not read yet (`R-GAP-000`). Counting
    colours the plan does not hold would be an invented figure.

## What was left

* **No drag on the canvas, no left panel of Designs, Graphics, Uploads and Colours, and no bottom dock** (select,
  hand, frame, marker, pen). The board draws the frames, the counters and the cards, and a style is added and changed
  through a form. The canvas positions are stored for whoever builds the drag.
* **No colour breakdown** (decision 14), and no per-colour totals.
* **No editing of a style card in place.** Quantities are changed in the line plan and a card is added through a form;
  changing a card's name, colourway, prices or status after it is on the board is not built. The data side is:
  `save_collection_style` takes a style id and the service and the action pass it through, so what is left is the
  screen, not a migration.
* **Lead time and the delivery date are not in the line plan.** `promisedDate` (decision 0071) needs a cut-off and an
  order date; a plan is not an order, so the table shows cost and margin only.
* **Nothing reads a sell-through rate**, because no row holds one.

## Rules with no entry yet

Every finding and every row this workstream writes carries `R-GAP-000`: the rulebook has no entry for freight, for the
basis duty is charged on, for a wholesale/D2C split, for a sell-through assumption, or for what makes a style ready to
sample. They are listed in the pull request comment.

## Evidence

| Claim | Test |
|---|---|
| The plan's tier cost equals `priceBasket` of the same pieces to the penny, at every quantity and across tier boundaries | `lib/collections/line-plan.test.ts` |
| Changing a quantity re-prices the line, and the tier is read across the whole plan | `lib/collections/line-plan.test.ts`, `e2e/studio-collections.spec.ts` |
| Tier plus freight plus duty, rounded once per piece, on the basis the row names | `lib/collections/landed.test.ts` |
| A missing freight row, currency, HS code or duty rate adds nothing and says so | `lib/collections/landed.test.ts` |
| Styles, style-colourways and SKUs, and a size at zero is no SKU | `lib/collections/board.test.ts` |
| Every figure comes from a row: the capability's tiers, the country rule, the freight row | `lib/collections/pricing.test.ts` |
| A drop payload carries targets, the counters and the labels, and no Store concept in any key or sentence | `lib/collections/drop.test.ts` |
| Which approved styles can be sampled, and why one cannot | `lib/collections/samples.test.ts` |
| Money typed as pounds becomes whole minor units; nothing unreadable is guessed at | `lib/collections/entry.test.ts` |
| The words of F-S10, and what the screens may send | `lib/collections/vocabulary.test.ts` |
| Every write sends the brand and the person from the session, and each refusal becomes the right failure | `lib/collections/service.test.ts` |
| The database refuses a closed market, a bad status or split, another brand's group or product, and every direct write; a drop payload is append-only and versioned per plan | `tests/integration/collections.test.ts` |
| The tables are invisible to another brand and unwritable by a browser | `tests/integration/isolation.test.ts` |
| The board, the live re-pricing at the tier boundary, the drop payload and the samples, in a browser | `e2e/studio-collections.spec.ts` |

## Owner questions

Recorded in the pull request comment.
