import type { Metadata } from "next";
import { OrderFilters } from "@/components/order-desk/OrderFilters";
import { OrdersArea } from "@/components/order-desk/OrdersArea";
import { NoOrders, OrdersTable } from "@/components/order-desk/OrdersTable";
import { marketOf } from "@/lib/make/market";
import { loadFactoryFacts } from "@/lib/order-desk/server";
import { listOrders } from "@/lib/order-desk/service";
import { filterOf } from "@/lib/order-desk/status";
import { filterOrders } from "@/lib/order-desk/views";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Orders" };

/**
 * Orders (09 screen 15, p09/p10; decision 0143): every order of the brand that reached production,
 * filtered by status chip and search. The statuses are F-T7's, read from the ops states, the QC
 * inspections and the parcels; "Paid" waits for checkout (C1) and shows as "Placed" until then.
 */
export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { brand } = await requireMember();
  const params = await searchParams;
  const filter = filterOf(params.status);
  const query = typeof params.q === "string" ? params.q : "";
  const [orders, facts] = await Promise.all([listOrders(await sessionClient(), brand.id), loadFactoryFacts(marketOf(params.market))]);
  const shown = filterOrders(orders, filter, query, brand.name);

  return (
    <OrdersArea current="/orders" discounts={facts.discounts}>
      <OrderFilters filter={filter} query={query} />
      {shown.length === 0 ? <NoOrders filtered={orders.length > 0 || filter !== "all" || query !== ""} /> : <OrdersTable orders={shown} customer={brand.name} />}
    </OrdersArea>
  );
}
