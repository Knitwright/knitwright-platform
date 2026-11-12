import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CustomerCard, DesignCard, ItemsCard, PhotosCard, ShipmentCard, SummaryCard } from "@/components/order-desk/OrderCards";
import { OrderFilters } from "@/components/order-desk/OrderFilters";
import { OrdersArea } from "@/components/order-desk/OrdersArea";
import { NoOrders, OrdersTable } from "@/components/order-desk/OrdersTable";
import { OrderTimeline } from "@/components/order-desk/OrderTimeline";
import { AppShell } from "@/components/shell/AppShell";
import type { CustomerOrder } from "@/lib/order-desk/service";
import { customerStatus, type Milestones } from "@/lib/order-desk/status";
import type { OrderStatus } from "@/lib/ops/status";
import { devRoutesEnabled } from "../dev-routes";
import { DevBoard } from "./board";

export const metadata: Metadata = { title: "Orders fixture", robots: { index: false, follow: false } };

/**
 * The Orders area with made-up data (decision 0143), for the 1440 × 900 comparison with p09, p10 and
 * p11. It reads nothing and needs no session; a production build answers 404 unless DEV_UI_ROUTES is
 * "on". `?empty` shows p10, `?detail` shows p11, `?board` shows p13.
 */

const DISCOUNTS = [
  { minQty: 20, percent: 10 },
  { minQty: 50, percent: 15 },
  { minQty: 100, percent: 20 },
];

const order = (n: number, name: string, ops: OrderStatus, milestones: Milestones, pieces: number, created: string): CustomerOrder => ({
  id: `${n}0f0c0de-0000-4000-8000-000000000000`,
  number: `KW-${n}0F0C0DE`,
  releaseId: "00000000-0000-4000-8000-000000000001",
  projectId: "00000000-0000-4000-8000-000000000002",
  productName: name,
  kind: "run",
  articleId: "JSY-SS-01",
  fabricKey: "F-POLY-INT",
  sizes: { S: 4, M: 9, L: 8, XL: 4 },
  pieces,
  value: { minor: pieces * 2500, currency: "GBP" },
  opsStatus: ops,
  status: customerStatus(ops, milestones),
  milestones,
  release: { label: "Home kit", number: 7 },
  readyOn: "2026-12-04",
  createdAt: created,
});

const NONE = { qcPassedAt: null, shippedOn: null };
const ORDERS = [
  order(1, "Home kit v7", "in_production", NONE, 25, "2026-11-02T10:00:00Z"),
  order(2, "Home shirt 2027", "submitted", NONE, 1, "2026-11-02T09:00:00Z"),
  order(3, "Compression top v3", "ready", { qcPassedAt: "2026-11-01T00:00:00Z", shippedOn: null }, 3, "2026-10-29T10:00:00Z"),
  order(4, "Away kit 2027", "ready", { qcPassedAt: "2026-11-01T00:00:00Z", shippedOn: "2026-11-03" }, 18, "2026-10-20T10:00:00Z"),
  order(5, "Training tees", "held", NONE, 120, "2026-10-08T10:00:00Z"),
];

function Detail() {
  const one = ORDERS[0]!;
  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-h1 text-text">
        {one.number} · {one.productName}
      </h1>
      <OrderTimeline status={one.status} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="flex flex-col gap-5">
          <ItemsCard order={one} />
          <ShipmentCard parcels={[]} delivery={{ status: "not-set", missing: ["the days for QC"], text: "No delivery date yet. Not set: the days for QC." }} />
          <PhotosCard fileIds={["a", "b", "c", "d", "e"]} />
        </div>
        <div className="flex flex-col gap-5">
          <SummaryCard
            summary={{
              lines: [
                { label: "Production (25 × £25.00)", value: "£625.00" },
                { label: "Team discount (20+ pieces)", value: "−£62.50", credit: true },
                { label: "Shipping", value: "Not on file" },
                { label: "Sampling", value: "None" },
              ],
              total: "£625.00",
              note: "The total is the price the order arrived with.",
            }}
          />
          <CustomerCard customer="Northfield FC" order={one} />
          <DesignCard order={one} />
        </div>
      </div>
    </div>
  );
}

export default async function DevOrdersPage({ searchParams }: PageProps<"/dev/orders">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  const workspace = { isClub: true, setUp: true };
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Northfield FC", workspace, credits: 1240 }}>
      {query.board !== undefined ? (
        <DevBoard />
      ) : query.detail !== undefined ? (
        <Detail />
      ) : (
        <OrdersArea current="/orders" discounts={DISCOUNTS}>
          <OrderFilters filter={query.empty !== undefined ? "cancelled" : "all"} query="" />
          {query.empty !== undefined ? <NoOrders filtered /> : <OrdersTable orders={ORDERS} customer="Northfield FC" />}
        </OrdersArea>
      )}
    </AppShell>
  );
}
