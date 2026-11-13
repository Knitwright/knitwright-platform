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
