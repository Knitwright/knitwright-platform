# Storefronts (decision 0154)

## Locally

- A storefront answers at `http://localhost:3000/shop/<slug>` (the path fallback of `<slug>.knitwright.com`).
- Put one live at `/store/storefront` (Name, Address, "Live: anyone with the address", Save storefront).
- Write a listing at `/products/<productId>/listing` (My products → the shop icon on a row). Publish needs the product
  at the run stage, a frozen release and a fabric; Listing health says what is missing.
- With no Stripe keys and `PAYMENTS_TEST_CHECKOUT=on`, Buy opens `/shop/<slug>/pay/<session>`: "Pay with a test card"
  signs the event and hands it to C1's webhook, as Stripe would.
- To try a host locally: `curl -H 'Host: <slug>.knitwright.com' http://localhost:3000/` is rewritten to `/shop/<slug>`.

## Batches

- `/api/cron/storefront-batches` runs hourly (`vercel.json`, `Authorization: Bearer $CRON_SECRET`). It closes drops
  whose window has passed, cuts one batch per listing per drop and per weekly cut-off (Monday 12:00 PKT), and sends
  each open batch through the brand run door. A refused batch refunds every shopper in it.
- A seller can send the week's paid sales now from `/store/storefront` → Batches → "Send paid sales now".
- A batch that failed for a fault (network, database) stays open and is tried again on the next run. A refund that
  failed is logged; refund it from `/ops/finance`.

## On a deploy

- Add a wildcard DNS record and certificate for `*.knitwright.com` pointing at the app. Set `STOREFRONT_ROOT_DOMAIN`
  only if the storefronts live under another domain.
- Stripe: see `docs/runbooks/stripe-test-mode.md` (decision 0152). Shopper payments are ordinary order payments.
