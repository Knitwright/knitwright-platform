import type { Metadata, Route } from "next";
import Link from "next/link";
import { ShipmentForm } from "@/components/ops/ShipmentForm";
import { manualProvider } from "@/lib/ops/shipping/provider";
import { latestInspection } from "@/lib/ops/qc/rows";
import { loadOrderOrNotFound } from "@/lib/ops/qc/order-page";
import { listInspections } from "@/lib/ops/qc/service";
import { sizesLine } from "@/lib/ops/format";
import { FULFILMENT_LABELS, fulfilmentOf, remainingSizes, shipBlocker } from "@/lib/ops/shipping/rules";
import { listShipments } from "@/lib/ops/shipping/service";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: shipping", robots: { index: false, follow: false } };

/** Parcels of one order. An order ships only after the factory marks it ready and an inspection passes. */
export default async function ShippingPage({ params }: PageProps<"/ops/orders/[orderId]/shipping">) {
  await requirePlatformAdmin();
  const { client, order } = await loadOrderOrNotFound((await params).orderId);
  const [inspections, shipments] = await Promise.all([listInspections(client, order.id), listShipments(client, order.id)]);
  const fulfilment = fulfilmentOf(order, shipments);
  const blocker = shipBlocker({ status: order.status, latestQc: latestInspection(inspections)?.result ?? null, fulfilment });
  const remaining = remainingSizes(order.sizes, shipments);

  return (
    <main id="main" className="rise">
      <p className="text-sm"><Link href={`/ops/orders/${order.id}` as Route} className="text-muted underline">Back to {order.externalRef}</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Shipping: {order.externalRef}</h1>
      <p className="mt-1 text-[15px] text-muted" data-testid="fulfilment">{FULFILMENT_LABELS[fulfilment]}. {manualProvider.describe}</p>

      <section aria-labelledby="record" className="mt-6">
        <h2 id="record" className="text-lg font-semibold text-ink">Record a parcel</h2>
        {blocker ? <p className="mt-2 text-[15px] text-muted" data-testid="ship-blocker">{blocker}</p> : <div className="mt-3"><ShipmentForm orderId={order.id} remaining={sizesLine(remaining)} /></div>}
      </section>

      <section aria-labelledby="parcels" className="mt-8">
        <h2 id="parcels" className="text-lg font-semibold text-ink">Parcels ({shipments.length})</h2>
        {shipments.length === 0 ? <p className="mt-2 text-[15px] text-muted">Nothing has been sent.</p> : (
          <ul className="mt-2 flex flex-col divide-y divide-hairline text-sm">
            {shipments.map((s) => (
              <li key={s.id} className="py-2" data-testid="parcel">{s.shippedOn} · {s.courier} · {s.trackingNumber} · {s.pieces} pieces ({sizesLine(s.sizes)}){s.note ? ` · ${s.note}` : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
