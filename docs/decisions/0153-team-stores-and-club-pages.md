# 0153: Team stores and club pages: store windows, no-account checkout, one order at close, refunds below the minimum, `<club>.knitwright.com`

Status: Accepted (plan v6 C2). Test mode only. Six owner questions are open (below); each has a labelled default and none blocks.
Index: Accepted; a store window per design (dates, sizes, names and numbers, minimum, 0-20% club margin) with link and QR; buyers pay through C1's Stripe Checkout with no account; at close the paid pieces become one run through submit_make_order (C1 and D1 gates run), below the minimum everyone is refunded; club pages at `<club>.knitwright.com` (or /clubs/<slug>)
Index title: Team stores and club pages
Date: 2026-11-13
Plan step: v6 wave 5, C2 (`plans/platform-v6.md`). Builds on 0131 (the Store comes in), 0152 (payments core), 0132 (D1 order gate), 0136 (privacy for people without accounts), 0087 (roster sign-up), 0144 (Team page), 0148 (Order drawer). Migration `20261228020000`.

## Context

Spec `02` F-T6: a kit manager opens a store for an approved design with open and close dates, roster or open sign-up,
an optional club margin (0/5/10/15/20%) paid to the club after close, and a minimum to proceed (default 10). Players
and parents buy from a short link or QR code without an account; at close the store becomes one order with one
delivery address; below the minimum buyers are refunded automatically. A club page at `<club>.knitwright.com` shows
the crest, colours, current kit, open stores, size guide and contact. F-T7: "Team stores: each buyer pays at checkout,
and the order is created at close." Until now the Order drawer's Team store tab said stores open with the Store.

## Decision

1. **Tables** (migration `20261228020000`), written only by functions the server's key runs; members read their
   club's rows: `team_stores` (the window, its prices and the one order it becomes), `team_store_orders` (one
   buyer's purchase and the C1 payment that holds the money), `team_store_order_lines` (one piece: size, shirt name,
   number), `club_pages` (address, contact line, published). `order_payments.purpose` gains `team_store`; such a
   payment is card, in full, with no account (`created_by` null).
2. **Opening** (`openTeamStoreAction`, the Order drawer's Team store tab): a store sells a run, so it opens only for
   a listed design with a frozen release and a golden sample covering it. Every check a run meets runs at opening,
   before anyone pays: the golden sample (and its carry-over note), the D1 validation gate, the content screen and
   the Class B review. The base price is the ladder's price per piece **at the store's minimum** (C1's `runPrice`
   over the tier rows); with no price on file a store cannot open, because its buyers pay by card. The margin per
   piece is `round_half_up(base × bps / 10000)`, worked out by the database. The longest shirt name is the name
   zone's row (`shirt_zone_limits`); numbers are 0-99 (F-T4 default). Opens at the start of its first day (or now),
   closes at the end of its last, within 90 days.
3. **Buying** (`/t/<code>`, public, never indexed or cached, rate limited per address): per piece a size and, where
   the store prints them, a name and number; then the buyer's name and email, the bot check, and Pay. Each piece is
   checked against the store, each name cleaned and screened (F-G1); then `open_team_store_payment` opens the
   purchase and its C1 payment and works the amount out from the store's own row (the browser sends no price), and
   C1's provider makes the checkout. A repeated request key answers the same payment. The checkout returns to the
   store's own pages (`/t/<code>/done`), not C1's member pages. With C1's test checkout (CI, local) the buyer goes to
   the store's own public test page, which signs the event and hands it to C1's webhook. **No second Stripe client
   and no webhook change**: a paid `team_store` payment is simply finished by C1's handler, and the store reads the
   payment's state.
4. **Closing** (`/api/cron/team-stores`, every 15 minutes, `CRON_SECRET`; and at once when the club presses Close
   now or Cancel and refund): `begin_team_store_close` counts the purchases paid at that moment, once.
   - At the minimum: the store is `closing` and names exactly one run (product, release, factory, fabric, the
     counted sizes, request key `team-store:<id>`). It is sent through `submit_make_order` as the member who opened
     the store. **C1's gate is widened by one case**: `private.order_is_paid` also accepts a closing store's own
     order, so the payment gate and then D1's gate in `submit_order_for_production` both run. Sent: `closed`, with
     the order, and the margin owed recorded. Refused by production: `refunding`, with production's words.
   - Below the minimum, cancelled, or nobody left at the club who may order: `refunding`. Every paid purchase is
     refunded in full through C1's `refundPayment` (Stripe first, then `record_payment_refund`), then `refunded`.
     A refund that fails is logged and tried on the next run.
   - A purchase paid after the count (a checkout finished after the close) is refunded on the next run.
5. **F-G4**: `private.finance_figures` counts team store payments in GMV and as open pre-order money until the
   store's order ships, so the refund reserve and the deposit headroom include them. Revenue stays collected less
   refunded; the club's margin is inside GMV and owed to the club (payout is C5's).
6. **Club pages**: `set_club_page` (owners, admins, kit managers) sets the address, contact line and whether it is
   public; addresses are unique and platform names are refused (`private.reserved_subdomain`, mirrored in
   `lib/team-stores/host.ts`). `/clubs/<slug>` shows the crest (a minute-long signed link), kit colours, the open
   stores, the club's size guide (the sign-up page's own, 0087) and the contact line. **Host routing**: `proxy.ts`
   asks `lib/hosts/rules.ts`, one rule per line in its owner's file; C2's `clubHost` rewrites the root of
   `<slug>.<CLUB_PAGES_DOMAIN>` to `/clubs/<slug>`. Unset `CLUB_PAGES_DOMAIN`: no rewrite. **Locally**: open
   `/clubs/<slug>` (the path fallback), or set `CLUB_PAGES_DOMAIN=localhost` and open `http://<slug>.localhost:3000/`.
7. **Where it shows**: the Order drawer's Team store tab opens a store and lists the design's stores (link, copy, QR,
   state, pieces against the minimum, price, margin, Close now, Cancel and refund); Team › Stores (P6's page, new
   tab) lists all the club's stores with the names and numbers collected, and the club page settings.
8. **Privacy** (0136): a buyer gives a name and email (receipt, refund) and per piece a size and optional shirt name
   and number; nothing else. All are in the erasure register; `purge_team_store_buyers` erases the name, email and
   shirt names 180 days after close, keeping the money record. The public pages never show a buyer.
9. **Dependency**: `qrcode-generator` 2.0.4 (MIT, no dependencies) draws the QR code as one SVG path.

## Owner questions (labelled defaults; none blocks)

- **C2-1.** Split delivery at courier cost (F-T6 step 3). Default: one order, one delivery to the club; split
  delivery is not offered yet.
- **C2-2.** Top-up below the minimum (F-T6 acceptance: "or the kit manager tops up the order"). Default: refund
  automatically; the kit manager can lower the minimum before close by opening a new store. A top-up checkout for
  the club is a follow-up.
- **C2-3.** The base price is the tier at the store's minimum, fixed for the store. Default: yes; a store that
  collects more is not repriced to a cheaper tier (the difference is Knitwright's), so buyers' money always covers
  the order.
- **C2-4.** Retention of buyers' details. Default: 180 days after close (refund and complaint window), then erased.
- **C2-5.** Names and numbers to the factory. Default: the run carries a `team_store` flag naming the store; the
  list is on Team › Stores. Feeding it into a team list for print files is a follow-up.
- **C2-6.** Supporters buying saved designs between seasons (Class A, MOQ 1). Default: a store with minimum 1.
- Also open from 0131/0152: the Stripe account, plan prices, going live, the wildcard DNS and certificate for
  `*.knitwright.com` (owner action; set `CLUB_PAGES_DOMAIN` on the deploy).

## Consequences

- The Store contract's `/api/store/team-stores` read is untouched; C6 retires it now that stores live here.
- C3's brand storefronts add their own host rule beside `clubHost`; the subdomain namespace is shared, so C3 should
  check `club_pages.slug` (or a shared reserved function) when it reserves brand addresses.
- `lib/team-stores/db.ts`, `reads.ts` and `server.ts` join the tables, processor and doors and are covered by the
  database test (`tests/integration/team-stores.test.ts`) and the browser test (`e2e/team-stores.spec.ts`).
- Fixtures: `/dev/team-stores?screen=cards|open|buy|receipt`.
