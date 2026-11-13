# 0154: Storefronts, drops, made-to-order batches and the listing editor

Status: Accepted (plan v6 C3). Test mode only. Seven owner questions are open (C3-6 was resolved at integration) (below); each has a labelled default and none blocks.
Index: Accepted; `<brand>.knitwright.com` storefronts (one namespace with clubs; path fallback `/shop/<slug>`) sell published listings through C1's checkout; drops from collection plans; paid sales go to production as one order per listing per cut-off through submit_brand_run's payment and D1 gates; listing editor (screen 23) with AI Improve on the credits ledger; returns policy per brand
Index title: Storefronts, drops and the listing editor
Date: 2026-11-13
Plan step: v6 wave 5, C3 (`plans/platform-v6.md`). Builds on 0131 (the Store comes in), 0152 (payments core), 0132 (D1 order gate), 0143 (Orders area, collection plans), 0142 (Products area), 0085 (collection drops), 0096 (flow listings), 0051 (credits ledger), 0094 (metered AI copy). Migration `20261228030000`.

## Context

Spec F-L5: a brand sells from `<brand>.knitwright.com`, themed from its brand kit, each product page with media, a
garment-measurement size chart, the delivery date and personalisation, paid through Stripe Checkout with Knitwright
UK as merchant of record. Two modes: a **drop** (a pre-order window made from a collection plan, which becomes one
batch at close) and **made-to-order** (Class A only, UK and Australia, single sales joining the weekly batch). Returns
are the brand's, shown before payment with a size-confirmation tick. Screen 23 (prototype p06) is the listing editor:
Mockups, Listing details with Improve listing, GPSR, Personalization, Pricing with profit, Publishing, Listing health.

Until now `lib/collections/drop.ts` wrote a drop *payload* for an outside Store and `flow_listings` a listing payload
(both read by the Store contract, which C6 retires); no listing, storefront or shopper order existed in the platform.

## Decision

1. **One listing model** (`listings`, one per brand product; `lib/storefront/listing.ts`): words, tags, size-table
   switch, up to ten pictures, personalisation (name length, number range, extra price), currency, a retail price
   per size, mode (`made_to_order` | `drop`), channel (`storefront` | `shopify` | `team_store`), hide-until-ready,
   sync-mockups, the fabric, and — once published — the release it is made from. **C4 reads this table** to push a
   listing to Shopify (`channel = 'shopify'`, `sync_mockups`); C5 links the editor from its Store pages. The editor is
   `/products/<productId>/listing` (09 screen 23) with a door on every My products row; the storefront's settings,
   drops and batches are `/store/storefront` (`lib/storefront/routes.ts`).
2. **Pictures are only the platform's.** The Mockup library offers the design's own render (true to colour) and the
   pictures a Mockup studio or Flow run handed over for that design with "Publish to store" (`flow_listings`), each
   with its "AI-generated" label, which the storefront shows. AI scene and Upload send the seller to the AI Studio
   workflows and Mockups, which hand their pictures back the same way. No other image can reach a listing.
3. **Listing health** (`health.ts`) is read off the listing: pictures, title and description, size table, EU
   responsible person, prices above cost, product at the run stage (golden sample approved), a frozen release, a
   fabric, made-to-order Class A only, storefront live. Blocking lines stop Publish, on the page and again in the
   action; warnings do not. Publish pins the newest frozen release.
4. **Pricing with profit** (`pricing.ts`): the production cost is the price ladder's own first-tier sell price (a
   made-to-order batch can be small, so the dearest piece), labelled; per size, retail − cost and margin. The ladder
   has no per-size price, so every size shows the same cost. **The prototype's histogram of "similar club shirts" is
   not drawn**: no market price data is on file, and the page says so rather than inventing one.
5. **Improve listing** rewrites the title, description and tags only, through the platform's text model
   (`chooseModels`), metered in microdollars like every AI call, and charged in credits through the existing ledger
   (`credit_spend`, kind `marketing_media`, keyed on the listing and the words, so asking again about the same words is
   free; everything is given back when nothing usable comes). `CREDITS_ENFORCED` off: the would-be charge is logged, as
   the credits gate does. No model key: "not connected". Nothing is faked.
6. **Storefronts** (`storefronts`, one per brand): slug (3–40, reserved names refused), name, draft | live, the
   returns policy (default: the spec's three rules, labelled as the platform's rule, not legal advice) and the EU
   responsible person for GPSR. Whoever puts it live is the person its batches are ordered as (`batch_owner`).
7. **Host routing, one namespace with the clubs.** Host rules live only in C2's `lib/hosts/rules.ts` (one per line;
   `proxy.ts` calls `rewriteForHost`, which now keeps the query string). The brand rule (`lib/storefront/host.ts`,
   `brandHost`) is listed first and rewrites `<name>.<CLUB_PAGES_DOMAIN>/…` to `/shop/<name>/…`, leaving C2's own paths
   on that host (`/clubs/…`, `/t/…`) alone. **Brands and clubs share one namespace**: triggers in this migration
   refuse a storefront slug that is reserved (`private.reserved_subdomain`) or a club's, and a club slug that is a
   brand's, under a lock on the name. So a name is never both, and no precedence is needed: when a name has no live
   storefront, `/shop/<name>` shows C2's club page (which is not found for neither). There is one root domain setting,
   C2's `CLUB_PAGES_DOMAIN`; with it unset (locally, on previews) a storefront answers at `/shop/<slug>`.
8. **A shopper's checkout** (`checkout.ts`, `open_shop_order`): no account, no cart; one size, a quantity (1–20), an
   optional name and number (screened, F-G1), email, country GB or AU, and both ticks. The database prices the order
   from the published listing and nothing the browser sends, refuses anything not on sale (`not_on_sale`,
   `size_not_sold`, `drop_closed`), and opens **an ordinary C1 card payment** (`order_payments`, purpose `order`, no
   lines, `created_by` null). C1's processor makes the checkout; C1's webhook marks it paid; the payment then counts in
   F-G4's GMV and cash and can be refunded from `/ops/finance`. Where no Stripe key is set the shopper gets this
   storefront's own test checkout (`/shop/<slug>/pay/<session>`), which signs the event and hands it to the same
   webhook; it needs the order's own random token. The shopper's order page is reached only with that token (its
   sha-256 is stored). **No second Stripe client and no change to C1's webhook.**
9. **Drops** (`storefront_drops`, `storefront_drop_listings`): made on `/store/storefront` from a collection plan
   (P5's `/orders/plans`; the plan's actions link there): each style's product's listing, with the style's planned
   pieces as targets, and every style that cannot be in it named. A drop listing sells only while one of its drops
   is open; "Hide in store until ready" keeps it off the grid until then. A drop that has not opened can be cancelled.
10. **Batches** (`storefront_batches`, `cut_storefront_batch`): every hour (`/api/cron/storefront-batches`, the same
    `CRON_SECRET` door as the weekly cut) drops whose window has passed are closed and each listing's paid orders in
    them become one batch; made-to-order sales made before the latest **Monday 12:00 PKT** (F-O1) become one batch per
    listing. A seller can send the paid sales now. Each batch is sent as **one order through the brand run door**
    (`placeOrder`: sizes, stage, fabric, the moderation screen, the D1 validation gate), under a payment line opened
    by `open_storefront_batch_payment` only when every shop order in the batch is paid, then C1's `fulfil`, so
    `submit_brand_run`'s payment gate decides it. That payment is an **invoice-method record with no charge** of its
    own: the shoppers' card payments hold the money, so nothing is counted twice in GMV. A batch the door refuses is
    marked refused and **every shopper is refunded in full** through C1's refunds.
12. **Payouts (C5, 0156).** Every paid shop order is recorded as a seller sale through `lib/store-pages/sales.ts`, as
    C2 does for team stores (`lib/storefront/payout.ts`, keyed `storefront:<order>`, so repeating it changes nothing):
    C5's margin calculator at the listing's production cost, the `storefront` channel fee row and the Knitwright fee;
    the batch's production order is attached once sent, and refunds are reported as their running total. It runs
    after every batch run (hourly) and when a shopper finishes the test checkout. C5's Overview links the storefront
    page and its drops (`STOREFRONT_EDITOR_HREF`, `NEW_DROP_HREF`).
13. **F-G4.** `private.finance_figures()` is replaced once more (C2's version plus one term): a paid storefront order
    is open pre-order money, so the refund reserve holds against it, until its batch is sent and that order ships —
    the same rule C2 uses for team stores.
11. Money tables (`shop_orders`, `storefront_batches`) are written only through the functions; the server's key holds
    SELECT on them. Listings, storefronts and drops are written by the server after its own permission check. Members
    read their brand's rows; visitors read nothing directly (the public pages read live, published rows with the
    server's key). Money rows outlive the brand and the listing (`set null`).

## Owner questions (labelled defaults; none blocks)

- **C3-1.** Bot check on the shopper's checkout. Default: none (a limit per address, and Stripe's own checkout);
  the roster sign-up's Turnstile can be added if abuse shows.
- **C3-2.** The returns policy wording. Default: the spec's three rules; each brand may rewrite its own. Legal review
  is still an owner action.
- **C3-3.** The production cost a seller sees. Default: the ladder's first tier (the dearest piece); a weekly batch
  may in fact land in a cheaper tier. Shipping and card fees are not in it.
- **C3-4.** The price of Improve listing. Default: the ledger's `marketing_media` price (1 credit, placeholder);
  the prototype says 2.
- **C3-5.** Personalised names and numbers reach the factory how? Default: kept on each shop order and shown on the
  storefront page; the batch order carries sizes only. The ops roster hand-off is a follow-up.
- **C3-6.** Resolved at integration: storefront orders count as open pre-orders (decision 13).
- **C3-7.** How long a shopper's email and printed name are kept, and how a shopper asks for erasure. Default: kept
  with the order as a money record (registered in `lib/deletion/team-data.ts` as personal data outside the brand
  register); erasure by ops on request.
- **C3-8.** The EU responsible person is asked twice: on the storefront (this decision) and in C5's Store settings.
  Default: both kept; the GPSR table reads the storefront's. One should read the other in a follow-up.
- Owner actions: a wildcard DNS record and certificate for `*.knitwright.com` on the hosted deployment
  (`CLUB_PAGES_DOMAIN`); the Stripe account (0152).

## Consequences

- Shared files touched with one entry each: `lib/hosts/rules.ts` (one host rule; `proxy.ts` keeps the query string),
  `lib/store-pages/routes.ts` (two doors), `lib/team-stores/host.test.ts` (the shared root's first rule), `lib/server/limits.ts` (`shopCheckout`), `lib/server/public-routes.ts`,
  `lib/server/public-pages.ts`, `vercel.json` (one cron), `vitest.config.mts`, the isolation test, My products (a
  listing link and the channel column), the collection plan's actions (a link to open a drop).
- The Store contract's drop and listing payloads are untouched; C6 retires them.
- `lib/storefront/db.ts`, `server.ts` and `run.ts` join the tables, the run context, the factory ladder, the file
  store and C1's payments; the database test (`tests/integration/storefronts.test.ts`) and the browser test
  (`e2e/storefronts.spec.ts`) cover them. The runbook is `docs/runbooks/storefronts.md`.
- The 1440 × 900 comparison with p06 is owed to the orchestrator: `/dev/storefront` renders the editor, the settings
  and the shop with fixture data and no database.
