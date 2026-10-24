import type { Metadata, Route } from "next";
import Link from "next/link";
import { QcForm } from "@/components/ops/QcForm";
import { listExceptions } from "@/lib/ops/exceptions/service";
import { EXCEPTION_LABELS } from "@/lib/ops/exceptions/rules";
import { CHECKLIST_LABELS } from "@/lib/ops/qc/checklist";
import { loadOrderOrNotFound } from "@/lib/ops/qc/order-page";
import { listInspections } from "@/lib/ops/qc/service";
import { STATUS_LABELS } from "@/lib/ops/status";
import { formatDateTime } from "@/lib/projects/dates";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: quality control", robots: { index: false, follow: false } };

/** The quality gate of one order: the inspections so far and the form for the next. A fail blocks shipping and opens a remake. */
export default async function QcPage({ params }: PageProps<"/ops/orders/[orderId]/qc">) {
  await requirePlatformAdmin();
  const { client, order } = await loadOrderOrNotFound((await params).orderId);
  const [inspections, exceptions] = await Promise.all([listInspections(client, order.id), listExceptions(client, { orderId: order.id })]);
  const remakes = exceptions.filter((e) => e.kind === "remake");
  const ready = order.status === "ready";

  return (
    <main id="main" className="rise">
      <p className="text-sm"><Link href={`/ops/orders/${order.id}` as Route} className="text-muted underline">Back to {order.externalRef}</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Quality control: {order.externalRef}</h1>
      <p className="mt-1 text-[15px] text-muted">{STATUS_LABELS[order.status]}. A failed inspection blocks shipping and opens a remake line for the factory.</p>

      <section aria-labelledby="record" className="mt-6">
        <h2 id="record" className="text-lg font-semibold text-ink">Record an inspection</h2>
        {ready ? <div className="mt-3"><QcForm orderId={order.id} /></div> : <p className="mt-2 text-[15px] text-muted">An order is inspected once the factory has marked it ready.</p>}
      </section>

      <section aria-labelledby="history" className="mt-8">
        <h2 id="history" className="text-lg font-semibold text-ink">Inspections ({inspections.length})</h2>
        {inspections.length === 0 ? <p className="mt-2 text-[15px] text-muted">None yet. Shipping waits for an inspection that passes.</p> : (
          <ol className="mt-2 flex flex-col divide-y divide-hairline text-sm">
            {inspections.map((i) => (
              <li key={i.id} className="py-2" data-testid="inspection">
                <span className="font-medium text-ink">{i.result === "pass" ? "Pass" : "Fail"}</span> · {formatDateTime(i.at)} · {i.defectCount} of {i.sampleSize} pieces with a defect · {i.photoFileIds.length} photos
                <ul className="mt-1 text-muted">
                  {i.checklist.map((c) => <li key={c.key}>{CHECKLIST_LABELS[c.key]}: {c.result.replace("_", " ")}</li>)}
                  {i.measurements.map((m) => <li key={m.point}>{m.point}: spec {m.specMm} mm, measured {m.measuredMm} mm, tolerance {m.toleranceMm} mm</li>)}
                </ul>
                {i.note ? <p className="text-muted">{i.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {remakes.length > 0 ? (
        <section aria-labelledby="remakes" className="mt-8">
          <h2 id="remakes" className="text-lg font-semibold text-ink">Remake lines</h2>
          <ul className="mt-2 text-sm text-ink-2">
            {remakes.map((e) => <li key={e.id} data-testid="remake-line">{EXCEPTION_LABELS[e.kind]}: {Object.entries(e.detail).map(([size, n]) => `${size} ×${String(n)}`).join(", ")}. Owner {e.owner}, due {e.dueOn}. {e.status === "open" ? "Open" : `Resolved: ${e.resolution ?? ""}`}</li>)}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
