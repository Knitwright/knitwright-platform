# Running payments locally with Stripe in test mode

Payments core is plan v6 C1, decision 0152. Never put a live key anywhere. The app refuses `sk_live_` at start-up.

## Without Stripe at all (the default for tests)

Set `PAYMENTS_TEST_CHECKOUT=on` in `apps/web/.env.local`, and leave both Stripe variables unset. Checkout then opens
the app's own test checkout at `/checkout/test/<session>`. It has **Pay with a test card** and **Cancel**. Each one
signs the event Stripe would send and hands it to the real webhook code. The browser tests always run this way
(`playwright.config.ts`).

## With Stripe's test mode

1. **Get the keys.** In the Stripe Dashboard, switch on **Test mode**. Go to *Developers → API keys* and copy the
   secret key (`sk_test_...`). A restricted key (`rk_test_...`) is also accepted. It needs write access to Checkout
   Sessions and Refunds.
2. **Forward the webhook** with the Stripe CLI (`stripe login` once):

   ```sh
   stripe listen --forward-to localhost:3000/api/payments/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,charge.refunded,customer.subscription.updated,customer.subscription.deleted,invoice.paid
   ```

   The CLI prints a webhook signing secret (`whsec_...`). It stays the same between runs on one machine.
3. **Set both** in `apps/web/.env.local`, and remove `PAYMENTS_TEST_CHECKOUT` (Stripe wins when both keys are set):

   ```sh
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   # STRIPE_AUTOMATIC_TAX=on   # only once Stripe Tax is set up in the test account
   ```

   With only one of the two set, checkout is shown as not set up. That is deliberate. A checkout whose webhook cannot
   be verified would take money that never reaches production.
4. **Start the app** as usual (`docs/runbooks/` and the local run notes). Order a sample of a design whose article
   has a price on file (today a football shirt, `JSY-SS-01`, through `knitwright-default`), buy a credit pack on
   `/credits`, or choose a plan in **Upgrade**. Pay with Stripe's test card `4242 4242 4242 4242`, any future
   expiry date and any CVC. `4000 0000 0000 9995` declines.
5. **Check it.** The CLI shows each event and the app's answer, which is 200, or 500 when it will be retried.
   `/checkout/return?payment=<id>` says where the payment stands. `/ops/finance` (platform admins) shows the
   payment, GMV, revenue and the deposit headroom, and refunds it. A refund made in the Stripe Dashboard arrives as
   `charge.refunded` and is counted once.

## What to look at when something is wrong

- **Webhook answers 400 "Signature mismatch".** `STRIPE_WEBHOOK_SECRET` is not the secret the CLI printed, or a
  proxy changed the body.
- **Webhook answers 503.** Neither Stripe nor the test checkout is set up on this run.
- **The payment stays "Waiting for the payment".** No event arrived. Is `stripe listen` running, and pointed at the
  right port?
- **Log says "A paid checkout did not match its payment".** Stripe reported a different amount or currency from
  the one the payment was opened for. Nothing was sent to production. Refund it in Stripe and look at why.
- **An order line says "Not sent".** The database refused the order after payment, for example a rulebook change
  since checkout. That line's share was refunded automatically. The reason is on the return page.

## Going live (owner action, not done)

Going live needs the UK entity's Stripe account, real plan prices, a refund reserve and a sample price (decision
0152, owner questions C1-1 to C1-5). It also needs a code change: `lib/config/env.ts` accepts test keys only.

## Seller payouts with Stripe Connect (plan v6 C5, decision 0156)

Sellers are paid their margin weekly, after delivery, by a transfer to their Stripe Connect **Express** account.
Knitwright stays merchant of record: buyers pay Knitwright, and the transfer moves the seller's share.

**Without Stripe.** With `PAYMENTS_TEST_CHECKOUT=on`, **Set up payouts** on `/store/payouts` opens the app's own test
onboarding at `/checkout/test/connect/<account>`. **Finish with test details** signs the `account.updated` Stripe would
send and hands it to the real webhook, so the account becomes active. Transfers get a `tr_test_kw_` id and nothing
leaves the machine. The browser tests run this way.

**With Stripe's test mode** (owner action first: switch Connect on in the Stripe Dashboard, *Connect → Get started*,
choose Express, and set the platform profile):

1. Keep C1's two keys as above, and add:

   ```sh
   STRIPE_CONNECT=on
   STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
   ```

   Stripe signs events from connected accounts (a seller's bank payout) at a separate **Connect** endpoint with its
   own secret. The same route, `/api/payments/webhook`, checks both secrets. Without the Connect secret payouts are
   shown as not switched on yet.
2. Forward both kinds of event with the CLI. `--forward-connect-to` uses the same signing secret as `--forward-to`
   locally, so set `STRIPE_CONNECT_WEBHOOK_SECRET` to the secret the CLI prints:

   ```sh
   stripe listen --forward-to localhost:3000/api/payments/webhook \
     --forward-connect-to localhost:3000/api/payments/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,charge.refunded,customer.subscription.updated,customer.subscription.deleted,invoice.paid,account.updated,payout.paid,payout.failed,transfer.reversed
   ```

   In a deployed test environment register two endpoints in the Dashboard with the same URL: one for "Events on your
   account" (C1's secret) and one for "Events on Connected accounts" (the Connect secret).
3. As an owner or admin, open `/store/payouts` and press **Set up payouts**. Stripe's test onboarding offers its own test
   values on each step (Stripe's "Testing Connect" page lists them).
4. Sales come from the storefront, drop and team-store checkouts (C2, C3) through `record_seller_sale`. A sale pays
   out once delivered: ops presses **Mark delivered** on `/ops/finance`, or it counts as delivered 14 days after the
   last parcel of its production order was sent.
5. Press **Run this week's payouts now** on `/ops/finance` (the scheduler calls `/api/cron/seller-payouts` on Fridays
   09:00 UTC with `CRON_SECRET`). Each payout becomes a transfer keyed by its id, so a second press sends nothing
   twice. Test-mode transfers need funds in the platform's test balance: pay a checkout with `4000 0000 0000 0077`
   (the card that makes the funds available at once) first.

**What to look at when something is wrong.** A payout marked "Failed, paid again next week" means Stripe refused the
transfer (the log says why: often no available balance, or the account cannot take transfers yet); its sales are
in the next run. "Check bank details" on the seller's Payouts tab is a `payout.failed` from their bank. A transfer
reversed in the Dashboard arrives as `transfer.reversed` and its sales are paid again.

**Going live (owner action, not done).** Connect in live mode, the payout countries (Pakistan is in Stripe preview),
the Knitwright fee, the delivery rule and the smallest payout (decision 0156, owner questions C5-1 to C5-5).
