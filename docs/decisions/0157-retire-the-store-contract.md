# 0157: Retire the Store contract: the read endpoints for an outside Store are removed

Status: Accepted (plan v6 C6). Supersedes 0106. Two gaps named below, both for X1; no owner question blocks.
Index: Accepted; supersedes 0106; app/api/store (five endpoints), lib/store-contract, STORE_SERVICE_TOKEN and docs/store-contract-v2.md removed once C1-C5 brought the Store inside; each thing 0106 promised mapped to 0152-0156; two gaps named for X1 (the Flow run's Publish to store has no handler, and a shopper can pay before the care label check refuses the batch)
Index title: Retire the Store contract
Date: 2026-11-13
Plan step: v6 wave 5, C6 (`plans/platform-v6.md`). Supersedes 0106 (the Store contract v2). Follows 0131 (the Store
comes in), 0152 (payments core), 0153 (team stores), 0154 (storefronts, drops and the listing editor), 0155 (sales
channels) and 0156 (store pages and payouts). No migration.

## Context

Decision 0106 built five signed read endpoints under `/api/store` so that a **separate** Store could read the
platform's products, drops, listings and team store configuration. Decision 0131 reversed the premise: the Store is
built inside the platform. C1 to C5 (decisions 0152 to 0156) are merged, so the platform now sells through its own
storefronts, team stores and Shopify channel, and nothing outside it reads the contract.

Before removing anything it was checked that nothing calls the contract:

* `git grep -n 'api/store\b'`: hits only in the contract's own files, `lib/server/public-routes.ts`, the
  `.env.example` comment, one comment in `tests/architecture/ops-access.test.ts`, and documents.
* `git grep -n store-contract`: no importer outside `lib/store-contract` and `app/api/store` itself. The only other
  code hits were `vitest.config.mts` (a coverage exclude and a 90% threshold entry) and the name of a database test
  that imports nothing from the contract.
* `git grep -n STORE_SERVICE_TOKEN`: only `lib/config/env.ts`, `apps/web/.env.example`, the contract's own files and
  documents. No CI workflow (`.github/workflows/ci.yml`), `vercel.json` cron, script or end-to-end test names any of
  the three. No runbook mentions the token.
* No module the contract imported is left without an importer (each of `lib/catalogue`, `lib/clubs/kit`,
  `lib/collections/drop`, `lib/compliance/model`, `lib/factory/*`, `lib/flows/listing`, `lib/home/book` and
  `lib/orders/text` has another non-test caller).

## Decision

**Remove the contract whole.** Gone: `apps/web/app/api/store/**` (the manifest, `products`, `drops`, `listings`,
`team-stores` and `routes.test.ts`), `apps/web/lib/store-contract/**` (31 files), `STORE_SERVICE_TOKEN` from
`lib/config/env.ts` and `apps/web/.env.example`, the five entries in `lib/server/public-routes.ts`,
`docs/store-contract-v2.md`, and the contract's coverage exclude and threshold entry in `vitest.config.mts`.

Kept on purpose: `tests/integration/store-contract.test.ts`. It imports nothing from the contract; it proves row
security on the catalogue, hand-off and personalisation tables and reads back the facts the storefront still rests
on (no AUD tier figure, no delivery date, one article with points of measure). Its header now says so.

Updated to match: the `mounted.test.ts` entry for `publishFlowListingAction` (its reader is now C3's listing editor,
not the contract), the comments in `lib/flows/{listing,actions,types}.ts`, `lib/flows/templates/product-listing.ts`
and `lib/teamwear/handoff.ts`, one comment in `ops-access.test.ts`, and the entry documents (`README.md`,
`docs/architecture.md`, `docs/launch-checklist.md`, `docs/owner/README.md`). Decision 0106's status reads
"Superseded by 0157", the way 0103 records being superseded by 0138.

### What 0106 promised, and where it lives now

| # | 0106 behaviour | Now | Where |
|---|---|---|---|
| 1 | An absent value is an explicit gap, never a `null` that renders as "today" or "free" | Held, by each screen rather than one payload. A product page says "No delivery date is promised until the factory confirms it" and shows no date. A listing's price is the seller's own retail per size per currency; listing health blocks Publish until one size is priced and above cost, and a missing ladder figure reads "not on file", never 0 | `app/shop/[store]/[listingId]/page.tsx`; `lib/storefront/pricing.ts` (`unitCost` returns `unpriced` with a reason), `lib/storefront/health.ts` (0154) |
| 2 | `GET /api/store`: a manifest of endpoints and the signing rule | Not needed: there is no outside reader | — |
| 3 | `GET /api/store/products`: published products with media, sizes, tier prices GBP/AUD, delivery, personalisation, size chart | The listing model: one listing per brand product, `draft`/`published`/`archived`, pictures, sizes with retail per size in GBP or AUD, personalisation (name length, number range, extra price), size table from the article's points of measure | `lib/storefront/listing.ts`, `media.ts`, `server.ts` (`sizeChart`), the listing editor (0154) |
| 3a | "A product is there because a hand-off names it" (`publishedBy`) | Replaced by an explicit publish: a seller publishes a listing in the editor; nothing is on sale otherwise (`not_on_sale`) | `lib/storefront/actions.ts` `publishListingAction`, `checkout.ts` (0154) |
| 3b | `sellability` with `care_label_refused`, `no_price_aud`, `no_delivery_date`, `no_size_chart`, `no_media` | Split. Price, size table and pictures are listing-health lines (0154). The care label is refused at production by the D1 order gate and `submit_brand_run`; a refused batch refunds every shopper in full through C1 (0154 item 10, 0153 for team stores). **See gap 2** | `lib/storefront/health.ts`, `lib/make/order-gate.ts`, `lib/storefront/run.ts` |
| 4 | `GET /api/store/drops`: Z4's drop payloads | Drops are made in the platform from a collection plan and sold on the storefront; the old `collection_drops` payload is still written by "Create drop" and is no longer read by anyone outside | `storefront_drops`, `lib/storefront/drops.ts` (0154) |
| 4a | `GET /api/store/listings`: L6's Flow listing payloads | `flow_listings` is read by the listing editor's mockup library as a picture source, each with its "AI-generated" label. **See gap 1** | `lib/storefront/media.ts`, `server.ts` (0154) |
| 5 | `GET /api/store/team-stores`: a club's colours, crest, sponsors, fonts, seasons and number rules | Team stores and club pages: a store per design with sizes, names and numbers (name length from `shirt_zone_limits`, a number range), and `<club>.knitwright.com` with the crest, colours, kit and open stores | `lib/team-stores/*`, `/clubs/<slug>` (0153) |
| 6 | Signed service token bound to payload kind and query | Not needed: no service reads across brands. The platform's remaining service doors (payments webhook, Shopify HMAC, cron secret) each have their own check (0152, 0155) | `lib/server/public-routes.ts` |
| 7 | Switched off (503) when the secret is unset | Not needed. Storefront and team store checkout are themselves off without the payment processor configured (C1, test mode only) | `lib/payments/` (0152) |
| 8 | No money in the contract (`no-payment.test.ts`) | Already removed by C1 on purpose (0152 item 13); the platform takes money now | 0152 |
| 9 | Row security on every table the contract read (database test) | Kept | `tests/integration/store-contract.test.ts` |

### 0106's owner questions

1. *Which design is a team store's?* Answered by C2: a store is opened for a chosen approved design (0153).
2. *Should the Store mark a hand-off collected (`flow_listings.collected_at`)?* Moot: no outside Store collects.
   The column and `collect_flow_listing` stay in the schema unused; dropping them would need a migration and is
   left for whoever next touches `flow_runs`.
3. *Does personalisation cost extra, and who decides?* Answered by C3: the seller sets an extra price on the listing
   (0154). `docs/owner/open-questions-v5.md` A6 still lists it; that file is a v5 snapshot.
4. *Should a product with gaps be offered at all?* Answered by C3: listing health blocks Publish on the gaps that
   matter to a buyer (price, cost); see gap 2 for the care label.
5. *Token lifetime and one secret per environment?* Moot: no token.
6. *Which markets may the Store sell in?* C1 sells in GBP and AUD; `country_rules.selling_enabled` is unchanged.

### Gaps (not covered by C1 to C5; for X1)

1. **The Flow run's "Publish to store" has no handler.** `FlowRunPanel` renders the button and takes
   `onPublishListing`, but `components/launch/LaunchShell.tsx` does not pass one, so nothing calls
   `publishFlowListingAction` and nothing writes `flow_listings`. Before C6 this was "a door that belongs to the
   contract"; now its reader is C3's mockup library, so a Flow run's pictures cannot reach a listing that way. This
   predates C6 (the action has had no caller since v5) and is listed in `mounted.test.ts`.
2. **A shopper can pay before the care label check refuses.** 0106 told an outside reader up front that nothing was
   sellable (`care_label_refused`, R-LAB-002). The storefront has no such up-front verdict: a published listing
   takes card payments, and the care label refusal comes at the batch, which then refunds everyone (0154 item 10).
   Nobody is charged for nothing, but a buyer waits for a refund. A listing-health line reading the same compliance
   verdict would stop Publish instead.

## Evidence

* The three `git grep`s above, run on `main` at `0d6ce16d` before the removal, and again after: none of
  `api/store\b`, `STORE_SERVICE_TOKEN` or `store-contract` is left in code except the kept database test's file name.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass locally after the removal; CI runs the database and end-to-end
  suites on the pull request.
* The token's only environment test was the contract's own `lib/store-contract/env.test.ts` (schema and
  `.env.example` entry), removed with it. `main` has no repository-wide `env-documented` test; the token is gone
  from both `lib/config/env.ts` and `.env.example`, so the two still agree.

## Alternatives

* **Keep the contract for a future outside reader.** Rejected: five public, cross-brand read endpoints with no
  caller are attack surface and maintenance with no user. If an outside Store ever returns, the record of what it
  read is 0106 and git history.
* **Keep `docs/store-contract-v2.md` as history.** Rejected: the entry documents sent readers to it as the thing to
  build against. Its content stays in git history and 0106.

## Consequences

* One less service secret to set and rotate, and five fewer public routes.
* `lib/store-contract`'s 100% coverage leaves the totals; the remaining directories keep their thresholds.
* Revisit if an outside reader of the catalogue appears (a marketplace feed, say): that would be a new, narrower
  contract, not this one.
