import type { Metadata, Route } from "next";
import Link from "next/link";
import { CartonForm, MakeBagsForm, PackBagForm } from "@/components/ops/PackingForms";
import { loadOrderOrNotFound } from "@/lib/ops/qc/order-page";
import { buildPackingList } from "@/lib/ops/packing/model";
import { listBags, listCartons, loadTeamList } from "@/lib/ops/packing/service";
import { STATUS_LABELS } from "@/lib/ops/status";
import { adminClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: packing", robots: { index: false, follow: false } };

/** Bags, labels and cartons of one order. Names are read from the team list for the labels and never stored by ops. */
export default async function PackingPage({ params }: PageProps<"/ops/orders/[orderId]/packing">) {
  await requirePlatformAdmin();
  const { client, order } = await loadOrderOrNotFound((await params).orderId);
  const [bags, cartons, team] = await Promise.all([listBags(client, order.id), listCartons(client, order.id), loadTeamList(adminClient(), order)]);
  const list = buildPackingList({ order, brandName: "", bags, cartons, roster: team.roster });
  const atFactory = order.status === "received" || order.status === "in_production" || order.status === "ready";

  return (
    <main id="main" className="rise">
      <p className="text-sm"><Link href={`/ops/orders/${order.id}` as Route} className="text-muted underline">Back to {order.externalRef}</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Packing: {order.externalRef}</h1>
      <p className="mt-1 text-[15px] text-muted">{STATUS_LABELS[order.status]}. {list.summary}.</p>
      {list.warnings.length > 0 ? <ul className="mt-2 text-sm text-warn" data-testid="packing-warnings">{list.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      <p className="mt-3 text-sm"><a href={`/api/ops/orders/${order.id}/packing-list`} className="font-medium underline" download>Download the packing list (PDF)</a></p>

      {atFactory ? (
        <>
          <section aria-labelledby="bags" className="mt-8">
            <h2 id="bags" className="text-lg font-semibold text-ink">Bags</h2>
            <div className="mt-2"><MakeBagsForm orderId={order.id} hasBags={bags.length > 0} /></div>
            <ul className="mt-3 flex flex-col divide-y divide-hairline text-sm">
              {bags.map((b, i) => (
                <li key={b.id} className="py-2" data-testid="bag">
                  <p className="text-ink">{list.bags[i]?.label.join(" · ")}</p>
                  <p className="text-muted">{list.bags[i]?.carton}</p>
                  {b.packedAt === null ? <PackBagForm orderId={order.id} bagId={b.id} bagNo={b.bagNo} /> : null}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="cartons" className="mt-8">
            <h2 id="cartons" className="text-lg font-semibold text-ink">Cartons</h2>
            <p className="mt-1 text-sm text-muted">Weigh and measure each carton and type the numbers in. Nothing is filled in for you: an empty box stays &quot;not set&quot;.</p>
            <ul className="mt-2 text-sm text-ink-2">{list.cartons.map((c) => <li key={c.no}>Carton {c.no}: {c.weight}, {c.size}, {c.bags} bags</li>)}</ul>
            <div className="mt-3"><CartonForm orderId={order.id} /></div>
          </section>
        </>
      ) : (
        <p className="mt-6 text-[15px] text-muted">Bags and cartons are set once the factory has the order.</p>
      )}
    </main>
  );
}
