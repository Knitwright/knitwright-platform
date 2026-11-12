# 0131: Build pack v3.9 replaces the v2.2 UI, and the Store is built inside the platform

Status: Accepted (owner, 2026-11-12)
Index: Accepted; the v2.2 UI is replaced by the Kittl shell of build pack v3.9, and checkout, team stores, storefronts, channels and payouts are built here; supersedes v5 owner decision 1
Index title: Build pack v3.9 and the Store comes in
Date: 2026-11-12
Plan step: v6, before wave 0. Supersedes plan v5 owner decision 1 ("the Store stays separate"). Supersedes the
top-bar decision 0103 for every screen v3.9 redraws. Decision 0106 (the Store contract v2) stays in force until v6
wave 5 retires it.

## Context

The founder sent build pack v3.9 (9 Nov 2026). Compared file by file with `docs/spec/` (v2.2):

- `01`, `03`, `04`, `05` and `07` are byte-identical once line endings are normalised.
- `02-features.md` adds one note: its layouts are superseded and it governs **behaviour, data, rules and acceptance
  tests only**.
- `06-build-plan.md` adds the v3 UI rebuild order and the rule that every UI PR carries a side-by-side screenshot.
- New: `08-ui-kittl-shell.md`, `09-screen-map.md` (33 screens), `10-design-system.md`, `prototype/index.html`, 109
  reference renders and 136 competitor screenshots.

The v3.0 changelog entry says it plainly: "The founder rejected the v2.2 UI. The whole platform now uses Kittl's
interface." The platform as merged at `09610f05` is the v2.2 UI throughout. It uses a dark glass theme with Geist and
cobalt, and its navigation is a pill bar on top. Its studio editor and its launch canvas are two separate shells.

v3.9 also draws the Store, Sales channels, Payouts, team-store checkout and the Order drawer's checkout as screens of
this platform. Plan v5 decision 1 had put all of that in a separate product.

## Decision

1. **`docs/spec/` is now build pack v3.9.** The new and changed text files and the prototype are committed there. The
   screenshot folders stay out of git: the owner gitignored `knitwright-build/`, and they are 82 MB. They are read from
   the local copy at `knitwright-build/references/` (every agent runs on this machine).
2. **The UI is rebuilt to v3.9.**
   - Layout follows the prototype.
   - Exact values follow `10-design-system.md`.
   - Behaviour, data and rules follow `02`.
   - The order is `06`'s rebuild order, planned in `plans/platform-v6.md`.
3. **The Store comes in (owner, 2026-11-12: "v3.9 does overrule the store stays separate").** The following are built in
   this platform, with Knitwright as merchant of record through the UK entity:
   - checkout (Stripe Checkout, GBP and AUD);
   - team stores and club pages (F-T6);
   - order tracking (F-T7);
   - storefronts and drops (F-L5);
   - sales channels, Shopify first (F-L6);
   - the seller dashboard and payouts via Stripe Connect Express (F-L7);
   - financial controls (F-G4).

   Spec decision 1 still holds: Knitwright is principal, there is no escrow, and there is no open factory
   marketplace.

## Evidence

- The file-by-file comparison of `knitwright-build/` with `docs/spec/`, run on 2026-11-12.
- A six-part gap audit of the code against v3.9 the same day, recorded in `plans/platform-v6.md` § "Where we start".

## Alternatives

- **Re-skin v2.2 pages without changing structure.** This was rejected. v3.9 changes structure: one canvas holds every
  board, there is a left rail, and Products, Orders and Store are new areas. A re-skin would fail the screenshot rule
  on every screen.
- **Keep the Store separate and draw v3.9's store screens as read-only status.** This was rejected by the owner.

## Consequences

- Every screen changes. Browser tests that find controls by label will move with their screens. A workstream that moves
  a screen owns the e2e specs for it.
- New owner actions:
  - a Stripe account for the UK entity (and Connect Express);
  - a Shopify Partner app;
  - plan prices (Starter / Studio Pro / Club & Scale);
  - the refund-reserve percentage, which `02` F-G4 defaults to 10%.
- The Store contract (`app/api/store/*`, `lib/store-contract/*`, decision 0106) becomes redundant once wave 5 lands, and
  is retired there, not before. The `no-payment` tests are deleted by the workstream that adds payment, not earlier.
- The v5 owner-action blockers are unchanged: ISO 3758 care symbols, the AUD ladder, QC and freight days, the pattern
  master's name, and the hosted deployment.
