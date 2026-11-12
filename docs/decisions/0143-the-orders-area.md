# 0143: The Orders area

Status: Accepted (plan v6, workstream P5)
Index: Accepted; /orders with Orders, Samples, Collection plans and Quotes, the order page with tracking and shared QC photos, collection plans moved from /studio/collections (308), "Placed" stands in for "Paid" until C1
Index title: The Orders area
Date: 2026-11-13
Plan step: v6 wave 2, P5. Builds on decisions 0043 (the ops door), 0050 (QC and shipping), 0071 (factory data), 0085 (collection plans), 0106 (quotes), 0132 (validation gates ordering), 0137 (components) and 0138 (the shell).

## Context

`09` screens 15, 32 and 33 and the prototype renders p09–p13 put a brand's orders, samples, collection plans and
quotes under one Orders area, with Printify's order list and order page as the layout. U2 left `/orders` as a
placeholder and the product runs at `/orders/runs`; the collection plans lived at `/studio/collections`. There is no
payment yet (checkout is C1), and members could read their brand's `ops_orders` but not its QC inspections or parcels.

## Decision

1. **Routes.** `/orders` (Orders), `/orders/samples`, `/orders/plans` (Collection plans) and `/orders/quotes` are the
   four tabs, drawn as links under the banner as p09 has them (`ORDERS_TABS`). The order page is `/orders/[orderId]`;
   a plan is `/orders/plan/[collectionId]` (`?view=list` for the line plan) and its delete page
   `/orders/plan/[collectionId]/delete`. `/orders/runs` keeps the v2.2 product-runs page and is reached from the
   Orders header ("Product runs", and "Create order" to its run builder); it links back to Orders.
2. **Collection plans moved.** `/studio/collections`, `/studio/collections/:id` and `/studio/collections/:id/delete`
   answer **308** to the new addresses (`lib/order-desk/moved.ts`, read by `next.config.ts`). Their actions, tests and
   behaviour are unchanged; the studio sidebar's Collections entry points at `/orders/plans`. The board is now
   one column per group (drop), each style card an attribute table of style, colourway, fabric, quantity, target cost
   (the line plan's landed unit cost), MOQ (the smallest priced tier), RRP, sizes and class, with "+ Add style" at the
   foot of every column and the navy totals bar under the board. The List / Board control is the segmented control.
3. **Statuses (F-T7).** The order's status is read from what exists: `submitted` is **Placed** (it stands where
   checkout's **Paid** will; C1 replaces it), `batched` In batch, `received` At factory, `in_production` In production,
   `ready` Awaiting QC, a passing inspection **QC passed**, a parcel **Shipped**, and `held` On hold. **Delivered** needs
   a courier's delivery scan, which nothing records, so no order reaches it. The chips Awaiting approval, Delivered and
   Cancelled match nothing yet and show p10's empty state.
4. **What a member sees after the factory has an order** (migration `20261222050000`): two `security definer`
   functions, `customer_order_milestones(order_ids)` and `customer_order_tracking(order_id)`, answer for an order of a
   brand the caller is a member of and give only: when QC passed, each parcel's courier, tracking number, tracking
   address, date and pieces, and the photos of a passing inspection that ops chose to share. The tables' policies are
   unchanged.
5. **QC photos are not shared by default.** `ops_qc_inspections.photos_shared` defaults to false. Ops shows or hides an
   inspection's photos from its QC page (`ops_share_qc_photos`, platform admins through the server key); the
   append-only trigger lets that one column change and nothing else. A photo opens through `/api/files/[id]/link`, so it
   is a file of the brand or nothing.
6. **No figure is invented.** The discount banner reads every tier saving from the factory ladders (the smallest
   saving at each quantity across articles). The order summary prices production at the smallest tier and shows the
   order's tier saving as the team discount; shipping and a sampling fee are "Not on file"; the total is the price the
   order arrived with, or "Not set". The delivery date is the ops ready date plus the QC days and the market's freight
   days, and says which is missing when any is. The settings strip states what is true today (approval by ops, email
   from ops, shipping and customs not set) rather than offering choices nobody made.
7. **Samples** lists every sample run (`brand_runs` of kind sample, with its order's status) and every golden sample,
   each linking to the design's make pages. **Quotes** lists a downloadable quote per collection plan (its styles
   summed per catalogue article) and per order of a catalogue article, priced again at today's tiers; nothing stores a
   quote (0106). The quote names a sport, which neither records, so the row asks for it.
8. **Reorder (F-T8)** is on the order page: the club reorder flow (Reorder, then Confirm, sizes from the season or the
   earlier list), plus "Order again from Product runs" for a sample or run.
9. **States (10 §9).** Each tab has a skeleton (`loading.tsx` inside its route group, so the order and plan pages
   answer 404 before anything streams), an empty state, and the area's error page with Retry and the request id. A
   viewer sees every page; ordering controls need the manage-kit ability, as before.
10. **Fixture.** `/dev/orders` (`?empty`, `?detail`, `?board`) draws p09, p10, p11 and p13 with made-up data for the
    1440 × 900 comparison, behind `DEV_UI_ROUTES`.

## Consequences

- New: `lib/order-desk/**` (90 % coverage; `server.ts` joins the factory rows and is excluded like its neighbours),
  `components/order-desk/**`, `components/collections/TotalsBar.tsx`, `components/ops/ShareQcPhotos.tsx`.
- e2e: `orders.spec.ts`; `studio-collections.spec.ts`, `collection-deletes.spec.ts`, `studio-catalogue.spec.ts` and
  `brand-runs.spec.ts` follow the moved addresses and the Product runs link. Database: `customer-orders.test.ts`.
- The prototype's checkbox column, Import CSV and "Reorder last season" are left out: there is no bulk action, no
  brand-level CSV import and no season-wide reorder for them to drive.

## Owner questions

1. **Order approval, default shipping, customs (DDP) and notifications** are shown as today's facts. Should they become
   brand settings, and with what choices?
2. **Delivered** needs a delivery event. Is a courier integration planned, or should ops mark it by hand?
3. **Order numbers** are `KW-` and the first eight characters of the order id. Is a sequential number wanted (it
   would need a sequence on `ops_orders`)?
4. **Shipping and sampling fees** are not on file anywhere. Where should they come from once C1 prices an order?

## R-GAP-000

No rulebook entry covers order tracking, quotes or the range plan layout; nothing here carries a rule id.
