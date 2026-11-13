# 0152: Payments core: Stripe Checkout, the payment gate before production, refunds, plans, credits and F-G4

Status: Accepted (plan v6 C1). Test mode only. Five owner questions are open (below); each has a labelled default and none blocks.
Index: Accepted; every app order door ends in Stripe Checkout (GBP, AUD) and submit_brand_run refuses an order no paid or invoice payment names; signed, idempotent webhook; refunds; plans billing and credit packs; F-G4 deposit cap with GMV and revenue apart; D1-3 credits back on order
Index title: Payments core
Date: 2026-11-13
Plan step: v6 wave 5, C1 (`plans/platform-v6.md`). Builds on 0131 (the Store comes in), 0132 (D1 order gate), 0144 (plans modal), 0148 (Order drawer), 0080 (make flow), 0062 (brand runs), 0085 (collection samples), 0051 (credits ledger). Migration `20261228010000`.

## Context

Decision 0131 brought checkout into the platform: Stripe Checkout in GBP and AUD through the UK entity, Knitwright
as merchant of record (F-T7), "factory deposits never exceed collected cash minus a refund reserve" and "revenue and
GMV are reported separately" (F-G4), plans billing for P6's modal (0144), credit top-ups (`03` credit_ledger
"top-up"). Until now every order door handed the order straight to production and Knitwright invoiced outside the
platform; the Order drawer said "Card checkout arrives with payments"; P6's plans modal said "Checkout is coming
soon"; and `lib/store-contract/no-payment.test.ts` asserted that nothing in the platform takes money.

Two facts shaped the design. First, `submit_brand_run` is the one door every app order goes through (the make flow's
sample, run and order modal via `submit_make_order`, the Order drawer, collection samples and the brand workspace's
run); `submit_order_for_production` is also the Store contract's door (0043/0106), which C6 retires. Second, today
only JSY-SS-01 has a price ladder, and its first tier starts at 10 pieces: almost every order has no price on file.

## Decision

1. **Payments are tables, written only by functions** (migration `20261228010000`): `order_payments` (one checkout:
   an order's lines, a credit pack or a plan; card or invoice), `order_payment_lines` (each order exactly as it will
   be sent), `payment_events` (each Stripe event id once), `payment_refunds`, `factory_deposits`,
   `brand_subscriptions`, and the labelled one-row `payment_settings`. Money is integer minor units, currency GBP or
   AUD. Members read their brand's payments, lines and plan; platform admins read everything; browsers write
   nothing. A brand's payments outlive the brand (`brand_id` set null), because money records must.
2. **The gate.** `submit_brand_run` refuses an order, with hint `payment_required`, unless a payment line names
   exactly it (brand, request key, product, kind, release, factory, fabric and sizes) and its payment is `paid`,
   `fulfilled` or `invoice`. It is asked last of the function's own checks and immediately before
   `submit_order_for_production`, so the D1 validation gate still runs on every paid order and refuses one whose
   checks now fail. The Store contract's direct call to `submit_order_for_production` is untouched (C6 retires it).
3. **Every app door ends in checkout** (`lib/payments/checkout.ts`), after its own refusals (sizes, golden sample,
   the D1 gate, the content screen, F-G2 flags), so nobody pays for an order that would be refused. The server
   prices each order from the ladder rows (`lib/payments/pricing.ts`), never from the browser. All lines priced: a
   Stripe Checkout for what is due now; the order goes to production when the webhook says paid. A line unpriced:
   by default the payment is an **invoice** and the orders go now, as before (setting `unpriced_orders`, C1-1).
   Doors: make sample, run and order modal (`lib/make/actions.ts`, so the Order drawer too), collection samples
   (`lib/collections/actions.ts`, one checkout for all), brand runs (`lib/brand-runs/actions.ts`, always invoice:
   its ladder has no currency). The drawer's "Card checkout arrives with payments" is replaced; a priced form's
   button reads **Checkout**; unpriced forms keep their old button and message.
4. **A deposit** (F-S7 "40% deposit + 60% before shipping for runs over £2,000") may be chosen on a run over the
   per-currency threshold; the card is charged the deposit and `balance_due_minor` records the balance, which the
   spec says Knitwright invoices. No AUD threshold until the AUD ladder exists. A deposit asked for where not allowed
   is charged in full.
5. **Stripe through one adapter** (`lib/payments/provider.ts`): `stripe.ts` over the REST API with `fetch` (no SDK
   dependency), a pinned API version, our payment id as the idempotency key, and ONE line charging exactly the
   amount opened, so `record_payment_paid` can refuse any other amount (`payment_mismatch`, left for a person).
   STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both needed; **the environment check accepts only test keys**
   (`sk_test_`/`rk_test_`), so going live is a deliberate code change. `STRIPE_AUTOMATIC_TAX=on` asks Stripe Tax for
   VAT/GST (C1-5).
6. **The test checkout** (`test-provider.ts`, `PAYMENTS_TEST_CHECKOUT=on`, refused on any deploy) stands in wherever
   there are no keys: CI, the browser tests, a local run. Its page `/checkout/test/<session>` makes the event Stripe
   would send, signs it with a secret derived from the server key, and hands it to the same `receiveWebhook`, so
   every test walks the real path.
7. **The webhook** `POST /api/payments/webhook` (public, rate limited) checks Stripe's signature over the raw body
   (HMAC-SHA256, five-minute tolerance, any `v1`), skips an event already recorded, acts, and records the event only
   after acting, so a failure answers 500 and Stripe retries. Every action is idempotent: a paid payment stays paid,
   a settled line is skipped, the door answers a repeated request key with its order, credits and refunds are keyed.
   Events: checkout completed / async succeeded / expired, `charge.refunded` (dashboard refunds, by total refunded),
   subscription updated / deleted, `invoice.paid` (plan renewals).
8. **Refunds.** A paid order line the database refuses (for example a rulebook change since checkout) is marked
   refused and its share refunded at once. Ops refunds any card payment from `/ops/finance`; the database refuses a
   refund larger than what is left; a payment refunded in full says `refunded`.
9. **Plans billing** (`lib/payments/billing.ts`): a Stripe Billing subscription made through Checkout with the
   price written into the session from P6's plan rows (still labelled placeholder). Monthly is the monthly price;
   annual is twelve of the annual monthly price, yearly. The plan's credits are granted when paid and on each
   renewal (`invoice.paid`). The entry point every upgrade button calls is
   `components/payments/plan-checkout.ts` `goToPlanCheckout(planId, billing)` over `startPlanCheckoutAction`; P6's
   modal calls it (its notice now says the checkout is opening), and G1's "Upgrade to export tech packs" can.
10. **Credit packs** go into the existing ledger with `credit_grant`, keyed `purchase:<payment>`. No pack price
    exists anywhere: each pack (500, 2,000, 5,000) is priced at the Starter plan's placeholder rate per credit,
    labelled on `/credits` (C1-4).
11. **F-G4.** `private.finance_figures()` works out per currency: GMV (whole value of card-paid orders), cash
    collected, refunded, **revenue** (collected less refunded, never added to GMV), open pre-orders (paid orders not
    all shipped, less refunds), the reserve (`refund_reserve_bps` of open pre-orders, rounded up, default 10%),
    deposits sent and the headroom. `record_factory_deposit` refuses a deposit above the headroom
    (`deposit_over_cash`), under a lock so two cannot share it. `/ops/finance` shows the figures, records deposits,
    edits the settings (saving clears the placeholder flag) and refunds.
12. **D1-3 is done**: after a paid or invoiced order reaches production, the credits spent on that design version
    come back as order credit (`credit_refund_for_order`, best-effort, once per spend). The spec says "Credits spent
    on a design come back as order credit when you order it".
13. **The `no-payment` test is deleted** (`lib/store-contract/no-payment.test.ts`) and replaced by
    `tests/integration/payments.test.ts` and the unit tests in `lib/payments`. `lib/make/wording.test.ts`'s "offers
    no payment of its own" now asserts the make flow says it is paid at checkout. The Store contract's code is not
    touched. Existing database tests that send orders directly pay first (`payFor` in `tests/integration/support.ts`).

## Owner questions (labelled defaults; none blocks)

- **C1-1.** An order whose article has no price on file: send it and invoice (default), or refuse it until priced?
  Setting `unpriced_orders` on `/ops/finance`.
- **C1-2.** The sample price. Default: each sample piece at the ladder's first tier price, labelled. (Spec has none.)
- **C1-3.** The refund reserve (F-G4 default 10%) and the deposit rule (40% over £2,000; no AUD deposit). Settings.
- **C1-4.** Credit pack sizes and prices. Default: 500 / 2,000 / 5,000 at the Starter plan's placeholder rate.
- **C1-5.** VAT/GST: are ladder prices VAT-inclusive, and should Stripe Tax compute tax? Default: off
  (`STRIPE_AUTOMATIC_TAX`), prices charged as stored.
- Also owner actions from 0131, still open: the Stripe account (UK entity) and Connect, plan prices, going live.

## Consequences

- No app order reaches production without a payment line naming it. Priced orders are paid first; unpriced orders
  are invoiced, as before, and recorded as invoice payments so P5 and ops can read how each order was paid.
- The brand workspace's run stays an invoice until its ladder carries a currency, or it is retired for the make flow.
- `lib/payments/db.ts`, `server.ts` and `ops-read.ts` join the tables, processor and doors and are covered by the
  database and browser tests. The runbook `docs/runbooks/stripe-test-mode.md` says how to run with Stripe test keys.
- The deposit's balance is recorded, not collected by the platform; collecting it is invoicing outside, per F-S7.
