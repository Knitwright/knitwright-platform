import { ArrowLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReorderButton } from "@/components/club/reorder/ReorderButton";
import { CustomerCard, DesignCard, ItemsCard, PhotosCard, ShipmentCard, SummaryCard } from "@/components/order-desk/OrderCards";
import { OrderTimeline } from "@/components/order-desk/OrderTimeline";
import { StatusPill } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { can } from "@/lib/clubs/roles";
import { listSeasons } from "@/lib/clubs/service";
import { marketOf } from "@/lib/make/market";
import { deliveryFor } from "@/lib/order-desk/delivery";
import { ladderForArticle, loadFactoryFacts } from "@/lib/order-desk/server";
import { getOrder, trackingOf } from "@/lib/order-desk/service";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/order-desk/status";
import { orderSummary } from "@/lib/order-desk/summary";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Order" };

/**
 * One order (09 screen 33, p11; decision 0143): where it is, its items, its parcels, the QC photos ops
 * shared, the summary, the customer and the locked design with its tech pack. An order of another
 * brand, or an id that is not one, is a page that does not exist.
 */
export default async function OrderPage({ params }: PageProps<"/orders/[orderId]">) {
  const { brand } = await requireMember();
  const { orderId } = await params;
  const client = await sessionClient();
  const order = await getOrder(client, brand.id, orderId);
  if (order === null) notFound();
  const currency = marketOf(order.value?.currency);
  const [tracking, facts, seasons] = await Promise.all([trackingOf(client, order.id), loadFactoryFacts(currency), listSeasons(client, brand.id)]);
  const summary = orderSummary({ kind: order.kind, pieces: order.pieces, currency, ladder: ladderForArticle(facts.snapshot, order.articleId), value: order.value });
  const delivery = deliveryFor({ readyOn: order.readyOn, qcDays: facts.qcDays, freightDays: facts.freightDays });
  const canOrder = can(brand.role, "manageKit");

  return (
    <div className="flex flex-col gap-6 pt-6">
      <Link href="/orders" className="flex w-fit items-center gap-2 text-h3 font-medium text-text-2 no-underline live:hover:text-text">
        <Icon icon={ArrowLeft} size={20} />
        Orders
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 text-text">
            {order.number} · {order.productName}
          </h1>
          <StatusPill tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</StatusPill>
        </div>
        {canOrder ? (
          <div className="flex flex-wrap items-center gap-2">
            {order.kind !== "order" ? <LinkButton href={"/orders/runs" as Route} variant="secondary">Order again from Product runs</LinkButton> : null}
            <div className="min-w-0">
              <ReorderButton releaseId={order.releaseId} seasons={seasons} />
            </div>
          </div>
        ) : null}
      </header>
      <OrderTimeline status={order.status} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="flex flex-col gap-5">
          <ItemsCard order={order} />
          <ShipmentCard parcels={tracking.parcels} delivery={delivery} />
          <PhotosCard fileIds={tracking.photoFileIds} />
        </div>
        <div className="flex flex-col gap-5">
          <SummaryCard summary={summary} />
          <CustomerCard customer={brand.name} order={order} />
          <DesignCard order={order} />
        </div>
      </div>
    </div>
  );
}
