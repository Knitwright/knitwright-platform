# 0156: Store pages, seller payouts through Stripe Connect Express, and the seller dashboard

Status: Accepted (plan v6 C5). Test mode only. Payouts are built behind env; Stripe Connect itself is an owner action. Five owner questions are open (below); each has a labelled default and none blocks.
Index: Accepted; /store has five tabs (Overview, Sales channels slot for C4, Branding, Settings, Payouts); sales recorded by the selling checkouts pay their margin weekly after delivery through Connect Express, reconciled in the database; margin calculator; payout liability on /ops/finance
Index title: Store pages and payouts
Date: 2026-11-13
Plan step: v6 wave 5, C5 (`plans/platform-v6.md`). Builds on 0131 (the Store comes in), 0152 (payments core), 0143 (orders and delivery), 0085 (landed cost), 0071 (price ladder). Migration `20261228040000`.

## Context

Spec F-L5 says the seller sets retail, Knitwright keeps the base price plus shipping and duty, and "the seller's
margin is paid out weekly after delivery confirmation via Stripe Connect Express". F-L7 asks for a dashboard of
sales, margin per product, payouts and orders, and "a margin calculator that shows profit per unit at a given retail
price (base + freight + duty + fees)". F-G4 adds "every payout is reconciled against delivered orders". Screen 16
(`/store`, prototype p14) and screen 25 (`/store/settings`, `/store/branding`, p17, p18) give the layout. Until now
`/store` was the v3.9 route map's placeholder (decision 0138).

The storefront, drop and team-store checkouts that make seller sales are C2's and C3's, running in parallel; the
sales channels are C4's. So this workstream had to define the seam those checkouts write to.

## Decision

1. **Five tabs, one page each** (`lib/store-pages/routes.ts`): Overview `/store`, Sales channels `/store/channels`,
   Branding `/store/branding`, Settings `/store/settings`, Payouts `/store/payouts`. `/store` keeps its address and
   its h1, so nothing moved and no redirect is needed. The v3.9 placeholder component retired with its last user.
2. **Doors for the other Store workstreams are one line each.** The Sales channels tab renders `ChannelsPanel` from
   `components/store-pages/ChannelsSlot.tsx`, an honest "on their way" state until C4 replaces that one export. The
   Overview's storefront, drops and team-stores cards and the "New drop" button read `STOREFRONT_EDITOR_HREF`,
   `NEW_DROP_HREF` and `TEAM_STORES_HREF` in `routes.ts`; null means "coming soon" text, never a dead link. C3 and
   C2 set them when their screens merge.
3. **Sales are rows** (`seller_sales`), written only by `record_seller_sale` with every part of the sale: retail,
   base, shipping, duty, channel fee, Knitwright fee, and the margin, which the database checks adds up and is not
   negative (`margin_negative`). The selling checkout's reference is the key, so a retried webhook records nothing
   twice (`sale_conflict` for another brand's reference). `lib/store-pages/sales.ts` is the TypeScript door for C2
   and C3, with `saleParts(marginFor(...), qty)` to make the parts. A drop that closes into one production order
   attaches it (`attach_seller_sale_order`); a refund is reported as the total so far (`record_seller_sale_refund`).
4. **The reconciliation is the database's** (`prepare_seller_payouts`, under an advisory lock). A sale is payable
   once delivered; it pays its margin less refunds, never below nothing; what is due is that less every line of
   every payout that has not failed. A payout per brand and currency is the sum of what is due, with one line per
   sale, made only for an account Stripe can pay (`payouts_enabled`) and only from the smallest payout (setting).
   So a refund after a payout makes that sale's due negative and comes off the next payout; a failed or reversed
   transfer's lines stop counting and the next run pays the same sales again; one pending payout per brand and
   currency at a time.
5. **Delivered.** No courier reports a delivery scan yet (0143). A sale counts as delivered when ops confirms it on
   `/ops/finance`, or when its production order's parcels cover every piece and the grace days (setting, default 14)
   have passed since the last one was sent.
6. **Stripe Connect Express through one adapter** (`lib/store-pages/connect.ts`): REST over `fetch` with C1's form
   encoding and pinned version, our ids as idempotency keys (`account:<brand>`, `transfer:<payout>`). Accounts are
   Express with the `transfers` capability; money moves as a transfer to the account ("separate charges and
   transfers": Knitwright stays merchant of record), and Stripe pays the seller's bank on the account's schedule.
   Real Stripe needs C1's test keys **and** `STRIPE_CONNECT=on` **and** `STRIPE_CONNECT_WEBHOOK_SECRET`; otherwise
   payouts say "not switched on yet". Wherever C1's test checkout is on, a test processor stands in: onboarding is
   `/checkout/test/connect/<account>`, which signs the `account.updated` Stripe would send and hands it to the one
   webhook.
7. **No second webhook route.** C1's parser hands `account.updated`, `payout.paid`, `payout.failed` and
   `transfer.reversed` to `lib/store-pages/connect-events.ts`; C1's handler accepts either the platform endpoint's
   secret or the Connect endpoint's (Stripe signs connected-account events at a separate endpoint with its own
   secret) and passes Connect events to `actOnConnect`.
8. **The weekly run** (`runPayouts`) prepares, then sends each pending payout as a transfer, marking it sent or
   failed. The scheduler calls `/api/cron/seller-payouts` on Fridays 09:00 UTC (vercel.json, the same `CRON_SECRET`
   door as the cut); ops can press it on `/ops/finance`.
9. **F-G4.** `/ops/finance` gains "Seller payouts": per currency, what is owed to sellers (delivered, not paid,
   including prepared payouts), held until delivery, and on its way, from `ops_seller_liability`; the newest sales
   waiting for delivery with "Mark delivered"; and the run. These are reported beside C1's figures and never added
   to them. C1's deposit headroom is unchanged (owner question C5-4).
10. **The margin calculator** (`lib/store-pages/margin.ts`, on the Overview) is `landedCost` (0085: the price tier
    for the batch, the market's freight row, duty on the article's HS code) plus the channel's fee row and the
    Knitwright fee setting. Every figure is a row; a missing one is a note, a loss is shown as a loss.
11. **Settings** (`store_settings`): GPSR's "Completed by Knitwright" table and "Needed from you" (EU responsible
    person, brand contact), with a warning that without the responsible person nothing sells into the EU or Northern
    Ireland; EPR's Germany LUCID number (checked as `DE` and digits), France Triman, the UK threshold note.
    **Branding**: packing inserts, neck labels, hang tags and gift messages from `store_branding_options` rows with
    placeholder costs, each switched on with a note. Owners and admins save; others read.
12. **Who reads what.** Members read their brand's settings, account, sales, payouts and payout lines; every
    signed-in person reads the three reference tables; platform admins read everything; browsers write nothing.
    Money rows outlive their brand (`brand_id` set null).

## Owner questions (labelled defaults; none blocks)

- **C5-1.** Is there a Knitwright fee on top of base, shipping and duty? Default: 0% (F-L5 names none), setting
  `knitwright_fee_bps`.
- **C5-2.** When is a sale "delivered" without a courier scan? Default: ops confirms it, or 14 days after the last
  parcel of its order was sent (`delivery_grace_days`).
- **C5-3.** A refund comes off the seller's margin, never below nothing; after a payout it comes off the next one.
  Should a defect refund (Knitwright's fault) leave the seller's margin whole instead? Default: no.
- **C5-4.** Should money owed to sellers also reduce the factory-deposit headroom (C1's F-G4 rule)? Default: shown
  beside it, not subtracted, so C1's rule stays exactly the spec's.
- **C5-5.** The smallest payout (default £1 / A$2) and the channel fee placeholders (storefront and team store
  1.5% + 20p / 1.75% + 30c; Shopify and API none). Owner action from 0131 still open: switch Connect on in the
  Stripe account, register the Connect webhook endpoint, and decide payout countries (Pakistan is in Stripe preview).

## Consequences

- C2 and C3 call `recordSellerSale` (and `attachSaleOrder`, `recordSaleRefund`) when their checkouts are paid,
  refunded or closed into an order; until they merge no sale exists and the pages show their empty states.
- C4 replaces one export in `ChannelsSlot.tsx`; C2 and C3 set one constant each in `routes.ts`.
- `docs/runbooks/stripe-test-mode.md` says how to run Connect in test mode.
- `/dev/store?view=` shows every tab with made-up data for the p14, p15, p17 and p18 comparisons.
- No dependency was added.
