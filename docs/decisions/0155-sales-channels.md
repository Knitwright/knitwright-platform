# 0155: Sales channels: the Shopify app, honest "later" cards, and API or CSV

Status: Accepted (plan v6 C4). Built against a Shopify stand-in. Its first real run needs the owner's Shopify Partner app (owner action from 0131). Five owner questions are open (below); each has a labelled default and none blocks.
Index: Accepted; Shopify OAuth, product push, fulfilment service, paid-order intake through submit_brand_run on an invoice line, and tracking sync, behind SHOPIFY_APP_*, HMAC-checked, with the token sealed AES-256-GCM; Etsy/TikTok/WooCommerce say later; CSV export and import
Index title: Sales channels
Date: 2026-11-13
Plan step: v6 wave 5, C4 (`plans/platform-v6.md`). Spec `02` F-L6, `09` screen 24, prototype p15/p16. Builds on 0131 (the Store comes in), 0152 (payments, the order gate), 0132 (D1 validation gate), 0116 (the content screen before an order), 0062 (brand runs). Migration `20261228050000`. The orchestrator assigned it because channel connections need storage.

## Context

F-L6 asks for a Shopify app: push products with variants, register Knitwright as the fulfilment service, pull
orders, sync tracking, and "an order in a connected Shopify store appears in ops within 5 minutes". Screen 24 shows
six channel cards and a "Connect to a sales channel" modal. Nothing in the platform held a per-brand connection.
`platform_settings` is for platform admins only, says "No secrets", and copies every value into an append-only
history, so this workstream stopped and asked for a migration. The orchestrator assigned one and accepted the
design below.

## Decision

1. **Three tables, written only by functions** (migration `20261228050000`):
   - `private.channel_connections`: one active shop per brand per channel, and one brand per shop. The access
     token is held only as ciphertext and nonce, and the table is in the private schema, out of the API's reach.
     Members learn its state through `channel_connections_of`, which never returns the token. Only owners and
     admins connect or disconnect.
   - `public.channel_listings`: the shop's product and variant for each product and size, with the release,
     fabric, factory profile and gate flags its orders are made on.
   - `public.channel_orders`: each order line a channel sent, recorded once, with what became of it and where its
     tracking went. Its ship-to address is the only personal data.

   Members read their own brand's listings and orders; platform admins read all; browsers write nothing.
2. **The token at rest**: AES-256-GCM with a fresh 12-byte nonce and the shop's domain as additional data, under
   `CHANNEL_TOKEN_KEY` (64 hex). A deploy with a Shopify app and no key refuses to start. Elsewhere the key is
   derived from the server key. The token is never logged and never sent to a browser. An uninstall or disconnect
   drops it at once.
3. **OAuth** (`lib/channels/shopify/oauth.ts`): an offline token. The `state` is a random nonce, kept in an
   httpOnly cookie signed with the app secret together with the brand, person, shop and a 10-minute expiry. The
   return is accepted only when Shopify's query HMAC checks and the cookie names the same person and brand as the
   session. On install, Knitwright registers itself as the shop's **fulfilment service** (its location is kept) and
   subscribes `orders/paid` and `app/uninstalled`. If registration fails it is logged and retried on the next push.
4. **Webhooks**: one address for every topic. `X-Shopify-Hmac-Sha256` is checked over the raw body before anything
   is read. The topics are:
   - `orders/paid`: takes the order in. A failure answers 500 so Shopify retries.
   - `app/uninstalled`: ends the connection and drops the token.
   - The mandatory privacy webhooks: `customers/redact` and `shop/redact` clear ship-to addresses (`shop/redact`
     also ends any connection left); `customers/data_request` is logged for ops to answer within 30 days (runbook).

   The fulfilment-service callback accepts waiting fulfilment requests, HMAC-checked.
5. **How a Shopify-paid order passes C1's gate.** Each Shopify line that matches one of our listings becomes one
   payment line, all on **one invoice payment** per order (`open_order_payment`, method `invoice`, lines with no
   value). Then C1's own fulfilment sends each line through `submit_brand_run` (kind `run`, door `brand_run`) as
   the member who connected the shop. The buyer paid the brand on Shopify, and Knitwright invoices the brand for
   making it. So C1's `payment_required` gate is satisfied the same way every invoiced order satisfies it, and
   D1's validation gate, the golden sample and stage rules all run on every line. C1's tables and functions are
   unchanged.
   - The request key is `shp-<orderId>-<lineId>`, so a repeated webhook, or a pull of an order already received,
     does nothing new.
   - A refusal is recorded on the channel line in the database's words.
   - Lines for the shop's own stock (no listing of ours) are left alone.
6. **Order gates at push.** Pushing a product, and importing a CSV, runs the same gates a run from the brand
   workspace runs (D1's validation gate, the content screen and Class B review, the F-G2 checklist), with the
   person present, and keeps the flags on the listing. Only products at the `run` stage can be listed.
   - Terms: the newest frozen release and the factory profile.
   - Fabric: one the profile lists (the first by default), or, where the profile lists none, the one the brand
     names, as the run builder does.
   - Each size gets the SKU `KW-<product>-<size>`. The price is the brand's retail price per piece, with the
     production cost and profit per piece shown beside it where the ladder has a price.
7. **Pull and tracking.** **Pull orders** reads the last 7 days of paid orders, which covers any webhook Shopify
   gave up on, and accepts waiting fulfilment requests. When ops records the first parcel of a Shopify order line
   (`ops_shipments`), its courier and number are sent to the shop, either by `/api/cron/channels-tracking` every 15
   minutes (CRON_SECRET) or by **Sync tracking**. A line is marked sent only after Shopify accepted it.
8. **One seam to Shopify** (`lib/channels/shopify/admin.ts`):
   - `graphql.ts` is the Admin GraphQL API at the pinned version `2025-07`, through `fetch`, with no SDK. It is
     used only with `SHOPIFY_APP_API_KEY` and `SHOPIFY_APP_API_SECRET` both set.
   - `stand-in.ts` is used with `SHOPIFY_APP_TEST_MODE=on`, which a deploy refuses. Its install page
     (`/store/channels/test-install`) signs the return and its **Send a test order** signs the webhook body,
     exactly as Shopify does, with a secret derived from the server key. So the browser tests walk the real
     handlers.
   - No test reaches Shopify.
9. **The screen** (`components/channels/ChannelsScreen.tsx`, route `/store/channels`) is self-contained so C5 can
   mount it as the Store's Channels tab (`heading={false}`). It has:
   - title and Connect; chips; the 2-column grid of the prototype's six cards;
   - the Connect modal with radio cards, Not now and Continue, where Continue on Shopify asks for the shop;
   - the Shopify manage panel (products with price, fabric, cost and profit; Push or Update; Pull orders; Sync
     tracking; Disconnect; the orders and their state);
   - the API or CSV panel.

   States:
   - loading: `loading.tsx`;
   - error: `error.tsx`;
   - empty: no products, no orders;
   - no permission: viewers see everything and change nothing, and kit managers list but do not connect, each
     disabled button saying why;
   - not set up: no app on this deploy;
   - no premium state: no plan gates channels.

   `/dev/channels` draws every state without a database.
10. **Etsy, TikTok Shop and WooCommerce say "Later"**, with a disabled button that says why, never a dead link.
    The **Knitwright team store** card says the same until C2's page exists: set `TEAM_STORE_HREF` in
    `lib/channels/catalogue.ts` to its route.
11. **API or CSV** (`docs/channels-api.md`): products-and-SKUs and channel-orders CSV exports, an orders template,
    and an orders CSV import that is checked whole and refused whole. Imported orders take the same invoice path.
    Spreadsheet cells that would run as formulas are written as text. A push API needs per-brand API keys and is
    later; the panel says so.

## Owner questions (labelled defaults; none blocks)

- **C4-1.** Who owes Knitwright for a Shopify order? Default: the brand, invoiced by Knitwright, because the buyer
  paid the brand on Shopify. The alternative is to charge the brand's card on file per order, which needs Stripe
  saved cards.
- **C4-2.** Do Shopify orders go to production as the member who connected the shop? Default: yes. If that member
  leaves or loses the ordering role, orders are refused with a message until someone reconnects.
- **C4-3.** How long are buyers' ship-to addresses kept? Default: until Shopify's redaction webhooks, or the
  brand's deletion. A fixed period after delivery would be a scheduled purge.
- **C4-4.** Which shipment's tracking goes to Shopify? Default: the first parcel of the order. Split parcels after
  the first are not sent.
- **C4-5.** What retail price does a pushed product carry? Default: one price for every size, typed by the brand.
  C3's listing editor may later set prices per size, and the listing row already holds a price per size.
- Also the owner action from 0131: the Shopify Partner app (runbook `docs/runbooks/shopify-app.md`), and its first
  real run against a development store (runbook §3).

## Consequences

- A Shopify order reaches ops through the same door, payment gate and D1 gate as every app order, and appears on
  the Channels screen with its outcome.
- The Admin API client has not yet run against a real shop; the runbook's §3 is that check.
- Pictures are not pushed yet: C3's listing editor owns a listing's mockups. The panel says to add pictures in
  Shopify.
- Dependencies: none added.
