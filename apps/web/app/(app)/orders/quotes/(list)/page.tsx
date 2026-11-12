import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { OrdersArea } from "@/components/order-desk/OrdersArea";
import { QuoteRow } from "@/components/order-desk/QuoteRow";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { Table, Th } from "@/components/ui/Table";
import { listCollections, loadPlan } from "@/lib/collections/service";
import type { CollectionPlan } from "@/lib/collections/types";
import { marketOf } from "@/lib/make/market";
import { loadFactoryFacts } from "@/lib/order-desk/server";
import { listOrders } from "@/lib/order-desk/service";
import { orderBasket, planBasket, type QuoteBasket } from "@/lib/order-desk/views";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { quoteHref } from "@/lib/quotes/download";
import { SPORTS } from "@/lib/teamwear/vocabulary";

export const metadata: Metadata = { title: "Quotes" };

const PLANS_QUOTED = 10;

/** The address of this basket's quote for each sport the quote may name. */
const sportsFor = (basket: QuoteBasket, clubName: string) =>
  SPORTS.map((sport) => ({
    id: sport.id,
    label: sport.label,
    href: quoteHref({ sportId: sport.id, currency: basket.currency, clubName, lines: basket.lines, unpriced: basket.unpriced }),
  }));

/**
 * Quotes (09 screen 15, spec F-T5, decision 0143). A quote is never stored (decision 0106): it is
 * built from a basket when it is downloaded. The baskets here are the brand's collection plans and
 * its orders of catalogue articles, each priced again at today's tiers.
 */
export default async function QuotesPage({ searchParams }: PageProps<"/orders/quotes">) {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const currency = marketOf((await searchParams).market);
  const [summaries, orders, facts] = await Promise.all([listCollections(client, brand.id), listOrders(client, brand.id), loadFactoryFacts(currency)]);
  const plans = await Promise.all(summaries.slice(0, PLANS_QUOTED).map((plan) => loadPlan(client, brand.id, plan.id)));
  const baskets: readonly QuoteBasket[] = [
    ...plans.filter((plan): plan is CollectionPlan => plan !== null).map(planBasket),
    ...orders.flatMap((order) => orderBasket(order, order.value ? marketOf(order.value.currency) : currency) ?? []),
  ];

  return (
    <OrdersArea current="/orders/quotes" discounts={facts.discounts}>
      {baskets.length === 0 ? (
        <EmptyState icon={<Icon icon={FileText} size={22} />} title="Nothing to quote yet" action={<LinkButton href="/teamwear">Build a kit to quote</LinkButton>}>
          A quote is made from a collection plan, an order of a catalogue article, or a kit in the teamwear configurator.
        </EmptyState>
      ) : (
        <Table caption="Quotes you can download">
          <thead>
            <tr>
              <Th>Quote</Th>
              <Th>From</Th>
              <Th numeric>Pieces</Th>
              <Th>Currency</Th>
              <Th>Sport</Th>
              <Th>PDF</Th>
            </tr>
          </thead>
          <tbody>
            {baskets.map((basket) => (
              <QuoteRow key={basket.id} basket={basket} sports={sportsFor(basket, brand.name)} />
            ))}
          </tbody>
        </Table>
      )}
    </OrdersArea>
  );
}
