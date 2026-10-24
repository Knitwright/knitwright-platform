import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderControls } from "@/components/ops/OrderControls";
import { AppError } from "@/lib/server/core/errors";
import { batchLabel, orderValue, sizesLine } from "@/lib/ops/format";
import { loadOrder, movableBatches } from "@/lib/ops/service";
import { STATUS_LABELS } from "@/lib/ops/status";
import { formatDateTime } from "@/lib/projects/dates";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: order", robots: { index: false, follow: false } };

/** One order: what it is, its status history and the controls for it. Platform admins only. */
export default async function OrderPage({ params }: PageProps<"/ops/orders/[orderId]">) {
  await requirePlatformAdmin();
  const parsed = z.uuid().safeParse((await params).orderId);
  if (!parsed.success) notFound();
  const client = await sessionClient();
  const loaded = await loadOrder(client, parsed.data).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  });
  const { order, events } = loaded;
  const batches = (await movableBatches(client, order)).map((b) => ({ id: b.id, label: batchLabel(b) }));

  return (
    <main id="main" className="rise">
      <p className="text-sm">
        {order.batchId ? <Link href={`/ops/batches/${order.batchId}` as Route} className="text-muted underline">Back to the batch</Link> : <Link href="/ops" className="text-muted underline">All batches</Link>}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{order.externalRef}</h1>
      <p className="mt-1 text-[15px] text-muted">{STATUS_LABELS[order.status]}</p>
      <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        <Row term="Article, fabric, factory">{order.articleId}, {order.fabricKey}, {order.factoryProfileId}</Row>
        <Row term="Release">{order.release.label} (release {order.release.number})</Row>
        <Row term="Pieces">{order.pieces} ({sizesLine(order.sizes)})</Row>
        <Row term="Value">{orderValue(order)}</Row>
        <Row term="Batch cut-off">{formatDateTime(order.cutoffAt)}</Row>
        <Row term="Lead time">{order.leadTimeDays === null ? "Not set" : `${order.leadTimeDays} days`}</Row>
        <Row term="Promised date">{order.promisedOn ?? "Not set"}</Row>
      </dl>

      <section aria-labelledby="controls" className="mt-8">
        <h2 id="controls" className="text-lg font-semibold text-ink">Change this order</h2>
        <div className="mt-3"><OrderControls orderId={order.id} status={order.status} batches={batches} /></div>
      </section>

      <section aria-labelledby="history" className="mt-8">
        <h2 id="history" className="text-lg font-semibold text-ink">History</h2>
        <ol className="mt-2 flex flex-col divide-y divide-hairline text-sm">
          {events.map((e) => (
            <li key={e.id} className="py-2" data-testid="order-event">
              <span className="font-medium text-ink">{e.kind.replaceAll("_", " ")}</span> · {formatDateTime(e.at)}
              {e.promisedOn ? ` · promised ${e.promisedOn}` : ""}
              {e.note ? <span className="text-muted"> · {e.note}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Row({ term, children }: Readonly<{ term: string; children: React.ReactNode }>) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{term}:</dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  );
}
