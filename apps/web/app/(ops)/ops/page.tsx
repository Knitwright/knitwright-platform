import type { Metadata, Route } from "next";
import Link from "next/link";
import { CutBatchesForm } from "@/components/ops/CutBatchesForm";
import { MetricsPanel } from "@/components/ops/MetricsPanel";
import { loadMetrics } from "@/lib/ops/metrics/service";
import { loadSettings, listBatches, listWaitingOrders } from "@/lib/ops/service";
import { batchLabel, formatValue, sizesLine, statusCounts } from "@/lib/ops/format";
import { describeCutoff } from "@/lib/ops/settings";
import { STATUS_LABELS } from "@/lib/ops/status";
import { formatDateTime } from "@/lib/projects/dates";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: batches", robots: { index: false, follow: false } };

/** Batches and the orders waiting for one. For platform admins only (decision 0043). */
export default async function OpsPage() {
  await requirePlatformAdmin();
  const client = await sessionClient();
  const [batches, waiting, settings, { metrics, truncated }] = await Promise.all([listBatches(client), listWaitingOrders(client), loadSettings(client), loadMetrics(client)]);

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Batches</h1>
      <p className="mt-2 text-[15px] text-muted">
        Weekly cut-off: {describeCutoff(settings)}. {settings.label}. {settings.leadTimeDays === null ? "No lead time is set, so no due date is promised." : `Lead time ${settings.leadTimeDays} days.`}{" "}
        <Link href="/ops/settings" className="text-ink underline">Change</Link>
      </p>
      <MetricsPanel metrics={metrics} truncated={truncated} />
      <div className="mt-6"><CutBatchesForm /></div>

      <section aria-labelledby="waiting" className="mt-8">
        <h2 id="waiting" className="text-lg font-semibold text-ink">Waiting for a batch ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">Nothing is waiting.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="py-1 pr-3">Order</th><th className="pr-3">Article, fabric</th><th className="pr-3">Pieces</th><th className="pr-3">Cut-off</th><th>Status</th></tr></thead>
            <tbody>
              {waiting.map((o) => (
                <tr key={o.id} className="border-t border-hairline" data-testid="waiting-order">
                  <td className="py-1.5 pr-3"><Link href={`/ops/orders/${o.id}` as Route} className="break-all font-medium underline">{o.externalRef}</Link></td>
                  <td className="pr-3">{o.articleId}, {o.fabricKey}</td>
                  <td className="pr-3">{o.pieces}</td>
                  <td className="pr-3">{formatDateTime(o.cutoffAt)}</td>
                  <td>{STATUS_LABELS[o.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="batches" className="mt-8">
        <h2 id="batches" className="text-lg font-semibold text-ink">Batches ({batches.length})</h2>
        {batches.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">No batch has been cut yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-hairline">
            {batches.map((b) => (
              <li key={b.id} className="py-3 text-sm" data-testid="batch">
                <Link href={`/ops/batches/${b.id}` as Route} className="text-[15px] font-medium text-ink underline">{batchLabel(b)}</Link>
                <p className="text-muted">
                  {b.orders} {b.orders === 1 ? "order" : "orders"}, {b.summary.pieces} pieces ({sizesLine(b.summary.sizes)}), value {formatValue(b.summary.value)}. {statusCounts(b.byStatus)}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-8 text-sm text-faint">Values are as the Store gave them. The platform sets no price.</p>
    </main>
  );
}
