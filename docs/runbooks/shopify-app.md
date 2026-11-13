# Runbook: the Shopify app (sales channels)

Plan v6 C4, decision 0155. The platform's Shopify app is built and runs against a stand-in in tests. To connect
real shops, the owner has to make the app in a Shopify Partner account. This page covers that step, how to run
the app locally, and what to do when something goes wrong.

## 1. Make the Partner app (owner action)

1. Sign in at partners.shopify.com with the Knitwright business account. Go to **Apps → Create app → Create app
   manually**. Name it "Knitwright".
2. **Distribution**: start with *Custom distribution* for one store, such as your development store. Choose
   *Public* (App Store) only when you are ready to list it. Shopify's review needs the privacy webhooks in step 4,
   and those are built.
3. **Configuration → URLs** (replace `https://app.knitwright.com` with the deploy's `NEXT_PUBLIC_SITE_URL`):
   - App URL: `https://app.knitwright.com/store/channels`
   - Allowed redirection URL: `https://app.knitwright.com/api/channels/shopify/callback`
   - Embedded in Shopify admin: **off**. Merchants use the app inside Knitwright, not inside the Shopify admin.
4. **Compliance webhooks** (mandatory): set all three to
   `https://app.knitwright.com/api/channels/shopify/webhooks`:
   - customers/data_request
   - customers/redact
   - shop/redact
5. **Access scopes**: the app asks for these at install, so nothing is ticked here:
   `write_products, read_orders, write_fulfillments, write_assigned_fulfillment_orders, write_inventory,
   read_locations`. For a Public app, `read_orders` covers only the last 60 days of orders, which is enough. Older
   orders are never needed.
6. Copy the **Client ID** and **Client secret**.

## 2. Configure the deploy

Set these on the deploy (server-only, never in the browser):

```
SHOPIFY_APP_API_KEY=<Client ID>
SHOPIFY_APP_API_SECRET=<Client secret>
CHANNEL_TOKEN_KEY=<output of: openssl rand -hex 32>
```

- A deploy with `SHOPIFY_APP_API_KEY` set refuses to start without `CHANNEL_TOKEN_KEY`. Each shop's access token is
  encrypted with that key (AES-256-GCM) before it is stored.
- **Never change `CHANNEL_TOKEN_KEY` while shops are connected.** Their tokens could no longer be read. If it does
  change, every shop has to disconnect and connect again.
- `SHOPIFY_APP_TEST_MODE` must be unset on a deploy, which refuses to start with it on.
- `CRON_SECRET` (already used by the weekly cut) also runs `/api/cron/channels-tracking` every 15 minutes
  (`apps/web/vercel.json`). That is the job that sends tracking back to shops.

## 3. First real run (owner, once)

The Admin API client (`apps/web/lib/channels/shopify/graphql.ts`, API version `2025-07`) was built from Shopify's
documentation. No test reaches Shopify, so its first real run is this check:

1. Make a development store in the Partner dashboard and add a test product of your own.
2. In Knitwright, as an owner, open **Store → Sales channels → Shopify → Connect** and type the development
   store's address. Approve the install in Shopify. You should land back on Sales channels with "Your Shopify shop
   is connected".
3. In the development store: **Settings → Locations** should list "Knitwright" (the fulfilment service), and
   **Settings → Notifications → Webhooks** should list orders/paid and app/uninstalled.
4. Push a product that has an approved golden sample, with a retail price. In Shopify it should appear with one
   variant per size, each SKU `KW-<product>-<size>`, stocked at the Knitwright location.
5. Place a test order for it in the store (Shopify's Bogus Gateway). Within a minute the order should appear on
   the Channels screen as "Sent to production", and in ops as a brand run. If it does not, press **Pull orders**,
   which reads the last week of paid orders.
6. In ops, record a shipment for that order with a courier and tracking number. Then press **Sync tracking** (or
   wait for the 15-minute job). The Shopify order should become fulfilled with that tracking.
7. Uninstall the app in the store. The Channels screen should show Shopify as not connected, and the stored token
   is deleted.

Write the outcome of each step in decision 0155's follow-up.

## 4. Running locally without a Partner app

Set `SHOPIFY_APP_TEST_MODE=on` in `apps/web/.env.local` (the browser tests already do). With this on:

- **Connect** goes to `/store/channels/test-install`, which signs the return the way Shopify does;
- **Send a test order** makes the `orders/paid` webhook Shopify would send for one piece of your newest listing,
  and hands it to the real webhook handler.

The test-mode secret is derived from the server key, so nobody outside can forge an event even on a machine that
has test mode switched on.

## 5. When something goes wrong

- **"The connection to this shop can no longer be read"**: the token does not open with this deploy's
  `CHANNEL_TOKEN_KEY` (the key changed, or the row was copied from another deploy). Disconnect, then connect again.
- **"Knitwright is not registered as this shop's fulfilment service yet"**: step 2 of the install failed (it is
  logged). The next push tries again.
- **An order line says "Refused"**: the message is the database's own refusal (D1's validation gate, C1's payment
  gate, the product's stage, or no member who may order). Fix the cause, then press **Pull orders**: a refused line
  stays refused, so the brand has to send that piece again by hand or by CSV.
- **"The person who connected this shop is no longer a member who may order"**: Shopify orders are placed as the
  member who connected the shop. Have an owner or admin connect again.
- **customers/data_request**: Shopify asks what Knitwright holds about a buyer. It is logged at warn level with the
  shop. Answer within 30 days from `channel_orders` (order name, product, size, pieces and the ship-to address)
  for that shop's orders.
