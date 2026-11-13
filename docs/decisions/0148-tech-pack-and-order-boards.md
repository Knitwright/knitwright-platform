# 0148: Tech pack and Order boards, the Order drawer, and the Export and Share popovers

Status: Accepted (plan v6 E4)
Index: Accepted; tech pack boards summarise the design's tech pack (16 pages, fields waiting) and open its page; order boards show the newest order on F-T7's timeline; the Order drawer (Sample · Run · Team store · Quote PDF) reuses the make flow and the D1 gate; Export and Share popovers with an open/close API
Index title: Tech pack and Order boards and the Order drawer
Date: 2026-11-13
Plan step: v6 wave 3, E4. Builds on 0145 (one canvas), 0132 (D1 order gate), 0080 (make flow), 0143 (Orders area), 0094 (export panel rules), 0049/0117 (share links and invites), 0106 (quotes). No migration.

## Context

`08` §5.2, §5.7 and the v3.6 block, screens 12–13, prototype states e20, e21, e27–e30. E1 (0145) added the
`tech_pack` and `order` kinds as shells whose card linked to `/studio/<id>/tech-pack` and `/studio/<id>/make`.
E2 builds the right panel's header with Share · Export · Order in parallel, so the panels had to stand alone.

## Decision

1. **Board bodies** (`components/order-boards/LinkedBoardBody.tsx`). A tech pack or order board draws its body
   above L6's card, in a box that is now at least `LINKED_BOX` 320 × 360 (`boxOf` floors boards stored at E1's
   320 × 220, so nothing is migrated). A board with no garment connected says so.
   - **Tech pack:** eight of the sixteen pages as thumbnails (e20), "16 pages · n fields need input · live-linked",
     **Open tech pack** (the page keeps its address) and **Export PDF**. The count is the editor tab's own
     `buildTechPackView` over the design's current version and base article (`lib/order-boards/server.ts`).
   - **Order:** the design's newest order from `ops_orders` (`listOrdersOfProjects`, joined like the Orders
     area): "Sample order · KW-…", pieces, price or "price on the invoice", ready date or "not set", the status
     chip and F-T7's seven steps, **Tracking** (`/orders/<id>`) and **Order again**; before any order, "No order
     yet" and **Order**, which opens the drawer.
2. **Mounting and the open/close API.** E2's right panel (0146) owns the Share · Export · Order buttons; E4 fills
   its slots (`components/editor-chrome/slots.ts`: `ShareSlot`, `ExportSlot`, `OrderSlot`), and a filled slot
   draws E4's own framed dialog instead of E2's box. `OrderBoardsProvider` (mounted by `/project/[id]` and
   `/dev/canvas` around the launch shell) carries the boards' data, the garment previews, and
   `useProjectPanels()` → `{ panel, open(id), toggle(id), close() }` for `share | export | order`, which an Order
   board's button and `/dev/canvas?panel=` use; `ProjectPanels` (one line in the launch shell) draws that one.
   Every panel is fixed under the right panel's buttons. Esc, × or a press outside closes it; the button that
   opened it toggles it.
3. **Which design.** The selected garment board's design, or the garment feeding a selected tech pack or order
   board, else the canvas's first design (`designFor`). Until that design's last stored validation passed
   (`orderGate`, `08` §5.1) the drawer's Sample and Run tabs say why instead of showing the forms. That is the
   early word only; the server's gate is the check.
4. **The Order drawer** (`OrderDrawer.tsx`). Tabs Sample · Run · Team store · Quote PDF. Its data is read when it
   opens (`loadOrderDrawerAction`: `loadMake` + this design's order products), with loading, error/Try again,
   and no-permission states. **Sample** and **Run** are the make flow's `SampleForm` and `SelectSizes`, so every
   send runs `requestSampleAction` / `selectSizesAction` and with them the D1 validation gate, the content screen
   and the golden-sample rule; Run shows `whyNoRun` instead of the table while no golden sample is signed off.
   **Checkout is C1's**: the drawer says the order is handed to production and invoiced outside the platform
   until payments land, with no Checkout button. **Team store** says stores open with the Store (wave 5) and
   links to `/team` (roster) and `/store`. **Quote PDF** builds an `/api/quotes` address for the design's
   catalogue article (sport, pieces, market, names and numbers); a test holds it to `quoteQuerySchema`.
5. **Export popover** (`ExportPopover.tsx`, e27). The artboard checklist ("All artboards (n)" / "Selected
   artboards (n)", every board but garments and their linked boards), W · H ("Mix" when they differ) · unit,
   format · dpi, Color with its note, the paid Additional settings (disabled, crowned), all through the export
   panel's `exportVerdict`. The artboard Export button says "not connected yet" exactly as the marketing panel
   does (`onExport` is still null). The **Garment board** block is live: Tech pack PDF (costs credits), Excel,
   and the production package ZIP (its own pre-export check). They are three download links rather than the
   prototype's two checkboxes, because one press starting three downloads is blocked by browsers.
6. **Share popover** (`SharePopover.tsx`, e28, e29). "Share project"; Link | Invite. Link is the existing
   one-version share link (`CreateLink`, now exported from `SharePanel`). Invite is `InviteForm` plus the member
   rows "Anyone at {brand}: Can access", "You: Owner" and **Knitwright factory desk: Tech pack only** (a fixed
   row: the desk sees the tech pack of a version an order hands over, never the canvas), then the invited
   addresses (`AccessList`, read on open by `loadShareAction`). **View presentation** and **Publish project**
   say they are not built yet; **Request approval** goes to Team › Approvals.
7. **Card fit.** L6's card overflowed its 248 × 168 box on the canvas (E1's note). The nudge arrows now take no
   room until one is focused (the board's arrow keys do the same), the name button is 28 px and the gaps 4 px,
   so every launch card's controls sit inside it.

## Consequences

- No table, no migration, no new route; `lib/order-boards` is held to 90% coverage.
- E2's buttons open E4's panels through its slots. The tech pack and order inspectors
  (e20, e21 right panel) are left to whoever builds the inspector by selection; the boards carry the same facts.
- Owner questions (defaults in brackets): should the factory desk be a real invitee with tech-pack-only access
  [no: a fixed row, the order is the hand-over]; should Order open for a design whose checks were never run
  [no: run the checks first]; is three download links acceptable for the Garment board export block [yes].
