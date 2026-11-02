import type { Metadata, Route } from "next";
import Link from "next/link";
import { InvoiceForm } from "@/components/ops/InvoiceForm";
import { ShipmentForm } from "@/components/ops/ShipmentForm";
import { listCouriers, selectCourierProvider } from "@/lib/ops/shipping/courier";
import { latestInspection } from "@/lib/ops/qc/rows";
import { loadOrderOrNotFound } from "@/lib/ops/qc/order-page";
import { listInspections } from "@/lib/ops/qc/service";
import { sizesLine } from "@/lib/ops/format";
import { FULFILMENT_LABELS, fulfilmentOf, remainingSizes, shipBlocker } from "@/lib/ops/shipping/rules";
import { listDestinations } from "@/lib/ops/invoice/load";
import { listInvoices } from "@/lib/ops/invoice/service";
import { listShipments } from "@/lib/ops/shipping/service";
import { adminClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: shipping", robots: { index: false, follow: false } };

/** Parcels of one order. An order ships only after the factory marks it ready and an inspection passes. */
export default async function ShippingPage({ params }: PageProps<"/ops/orders/[orderId]/shipping">) {
  await requirePlatformAdmin();
  const { client, order } = await loadOrderOrNotFound((await params).orderId);
  const [inspections, shipments, couriers, invoices, destinations] = await Promise.all([
    listInspections(client, order.id),
    listShipments(client, order.id),
    listCouriers(adminClient()),
    listInvoices(client, order.id),
    listDestinations(client),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const fulfilment = fulfilmentOf(order, shipments);
  const blocker = shipBlocker({ status: order.status, latestQc: latestInspection(inspections)?.result ?? null, fulfilment });
  const remaining = remainingSizes(order.sizes, shipments);

  return (
    <main id="main" className="rise">
      <p className="text-sm"><Link href={`/ops/orders/${order.id}` as Route} className="text-muted underline">Back to {order.externalRef}</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Shipping: {order.externalRef}</h1>
      <p className="mt-1 text-[15px] text-muted" data-testid="fulfilment">{FULFILMENT_LABELS[fulfilment]}. {selectCourierProvider().describe}</p>

      <section aria-labelledby="record" className="mt-6">
        <h2 id="record" className="text-lg font-semibold text-ink">Record a parcel</h2>
        {blocker ? <p className="mt-2 text-[15px] text-muted" data-testid="ship-blocker">{blocker}</p> : <div className="mt-3"><ShipmentForm orderId={order.id} remaining={sizesLine(remaining)} couriers={couriers.map((c) => ({ id: c.code, label: c.name }))} /></div>}
      </section>

      <section aria-labelledby="invoice" className="mt-8">
        <h2 id="invoice" className="text-lg font-semibold text-ink">Commercial invoice</h2>
        <p className="mt-1 text-sm text-muted">
          With the HS code and the origin on file, for the destination&apos;s own preference scheme. An invoice is a record: once issued it
          stands, and a correction is a new invoice.
        </p>
        {order.status === "ready" ? (
          <div className="mt-3">
            <InvoiceForm orderId={order.id} destinations={destinations.map((d) => ({ id: d.country, label: `${d.name} (${d.country})` }))} today={today} />
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-muted" data-testid="invoice-blocker">
            An invoice is issued once the factory has marked the order ready. Mark it ready on the order page first.
          </p>
        )}
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No invoice has been issued for this order.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-hairline text-sm">
            {invoices.map((i) => (
              <li key={i.id} className="py-2" data-testid="invoice">
                Invoice {i.invoiceNo} · {i.issuedOn} · {i.originCountry} to {i.destinationCountry} · {i.preferenceScheme ?? "no scheme on file"} ·{" "}
                <a href={`/api/ops/orders/${order.id}/commercial-invoice?invoice=${i.invoiceNo}`} className="underline">
                  Download the PDF
                </a>
                {i.missing.length > 0 ? <p className="text-muted">Could not state: {i.missing.join(" ")}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="parcels" className="mt-8">
        <h2 id="parcels" className="text-lg font-semibold text-ink">Parcels ({shipments.length})</h2>
        {shipments.length === 0 ? <p className="mt-2 text-[15px] text-muted">Nothing has been sent.</p> : (
          <ul className="mt-2 flex flex-col divide-y divide-hairline text-sm">
            {shipments.map((s) => (
              <li key={s.id} className="py-2" data-testid="parcel">{s.shippedOn} · {s.courier} · {s.trackingNumber} · {s.pieces} pieces ({sizesLine(s.sizes)}){s.note ? ` · ${s.note}` : ""}
                {s.trackingUrl ? <> · <a href={s.trackingUrl} rel="noreferrer noopener" target="_blank" className="underline">Track</a></> : null}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
