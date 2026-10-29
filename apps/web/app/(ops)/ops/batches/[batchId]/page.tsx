import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PacketSection } from "@/components/job-packet/PacketSection";
import { AppError } from "@/lib/server/core/errors";
import { batchLabel, orderValue, sizesLine } from "@/lib/ops/format";
import { summariseOrders } from "@/lib/ops/grouping";
import { loadBatch } from "@/lib/ops/service";
import { STATUS_LABELS } from "@/lib/ops/status";
import { formatDateTime } from "@/lib/projects/dates";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";
import { formatValue } from "@/lib/ops/format";

export const metadata: Metadata = { title: "Ops: batch", robots: { index: false, follow: false } };

/** One batch: its orders, totals and the factory sheet and print files to download. */
export default async function BatchPage({ params }: PageProps<"/ops/batches/[batchId]">) {
  await requirePlatformAdmin();
  const parsed = z.uuid().safeParse((await params).batchId);
  if (!parsed.success) notFound();
  const client = await sessionClient();
  const loaded = await loadBatch(client, parsed.data).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  });
  const { batch, orders } = loaded;
  const summary = summariseOrders(orders);

  return (
    <main id="main" className="rise">
      <p className="text-sm"><Link href="/ops" className="text-muted underline">All batches</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{batchLabel(batch)}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {orders.length} {orders.length === 1 ? "order" : "orders"}, {summary.pieces} pieces ({sizesLine(summary.sizes)}), value {formatValue(summary.value)}. Cut-off {formatDateTime(batch.cutoffAt)}.
      </p>
      <p className="mt-4 flex flex-wrap gap-4 text-sm">
        <a href={`/api/ops/batches/${batch.id}/factory-sheet`} className="font-medium underline" download>Download factory sheet (PDF)</a>
        <a href={`/api/ops/batches/${batch.id}/print-files`} className="font-medium underline" download>Download print files (ZIP)</a>
      </p>
      <p className="mt-1 text-sm text-faint">The print files are built again from each release when you ask. The manifest lists any file whose hash differs from the one frozen with its release.</p>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-muted"><tr><th className="py-1 pr-3">Order</th><th className="pr-3">Release</th><th className="pr-3">Pieces</th><th className="pr-3">Value</th><th className="pr-3">Promised</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-hairline" data-testid="batch-order">
              <td className="py-1.5 pr-3"><Link href={`/ops/orders/${o.id}` as Route} className="font-medium underline">{o.externalRef}</Link></td>
              <td className="pr-3">{o.release.label}</td>
              <td className="pr-3">{o.pieces} ({sizesLine(o.sizes)})</td>
              <td className="pr-3">{orderValue(o)}</td>
              <td className="pr-3">{o.promisedOn ?? "Not set"}</td>
              <td>{STATUS_LABELS[o.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PacketSection client={client} batchId={batch.id} />
    </main>
  );
}
