# Sales channels: what exists (API or CSV)

Plan v6 C4, decision 0155. This page lists every door the sales channels have today. **There is no push API for
orders yet**: custom shops and club systems use the CSV import, and Shopify uses its app. The Channels screen says
so too.

## For a signed-in member (the browser session)

| Door | What it does |
|---|---|
| `GET /api/channels/export/products` | The brand's products as CSV, one row per product and size: `sku, product_id, product, size, stage, shopify_price, currency, shopify_product_id`. Any member. |
| `GET /api/channels/export/orders` | The brand's channel order lines as CSV, newest first: `received_at, channel, order, line, product, size, pieces, state, message, knitwright_order_id, tracking_sent_at`. Leaves out buyers' addresses. Any member. |
| `GET /api/channels/import-template` | The orders CSV to fill in. |
| Import orders (Channels screen, API or CSV panel) | Uploads an orders CSV (at most 256 KB and 200 rows). Owners, admins and kit managers. |

**SKUs.** Each sellable size has the SKU `KW-<product id without dashes>-<size>`, with any character other than a
letter, digit, `_` or `-` written as `_`. The products export lists them. Both CSV import and Shopify orders find
the product and size from the SKU.

**Orders CSV.** Columns:

- `order_ref`: your order number, 1 to 30 letters, digits, `-` or `_`;
- `sku`;
- `quantity`: 1 to 9999;
- `fabric` (optional): where the product is not listed on a channel yet and the factory lists no fabrics;
- `ship_name, ship_address1, ship_address2, ship_city, ship_region, ship_postcode, ship_country` (ISO alpha-2),
  `ship_phone`.

All rows are checked before any is taken in, and one bad row refuses the whole file. Rows that share an
`order_ref` form one order. Importing the same `order_ref` again does nothing new. Each product must be ready to
sell (an approved golden sample), and its order gates run at import.

**What happens to an order.** Every line goes to production through `submit_brand_run` with an **invoice** payment
line (decision 0152): the buyer paid you, and Knitwright invoices you for making it. D1's validation gate runs on
each line. The answer counts the lines sent and refused, with the refusals in the database's own words.

## For Shopify (no session; HMAC-signed)

| Door | What it does |
|---|---|
| `GET /api/channels/shopify/callback` | The OAuth return. Checks Shopify's query HMAC, the signed state cookie, and that the member is the one who started the install. |
| `POST /api/channels/shopify/webhooks` | `orders/paid`, `app/uninstalled`, `customers/data_request`, `customers/redact`, `shop/redact`. Checks `X-Shopify-Hmac-Sha256` over the raw body. |
| `POST /api/channels/shopify/fulfilment/fulfillment_order_notification` | The fulfilment service's callback: accepts the shop's waiting fulfilment requests. HMAC-checked. |
| `GET /api/cron/channels-tracking` | The scheduler's job (bearer `CRON_SECRET`). Sends tracking for shipped Shopify order lines. |

Setup and first run: `docs/runbooks/shopify-app.md`.

## Not built yet

A push API for orders (needs per-brand API keys), Etsy, TikTok Shop, WooCommerce, and product pictures sent to
Shopify (C3's listing editor owns a listing's mockups).
