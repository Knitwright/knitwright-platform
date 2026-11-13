import { LayoutGrid } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { NewCollection } from "@/components/collections/NewCollection";
import { OrdersArea } from "@/components/order-desk/OrdersArea";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/PageStates";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { can } from "@/lib/clubs/roles";
import { loadCollections, loadMarkets } from "@/lib/collections/server";
import { pieces, styleWord } from "@/lib/collections/vocabulary";
import { marketOf } from "@/lib/make/market";
import { shortDate } from "@/lib/order-desk/format";
import { loadFactoryFacts } from "@/lib/order-desk/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Collection plans" };

/**
 * The brand's collection plans (spec F-S10), moved from `/studio/collections` to Orders › Collection
 * plans (plan v6 P5, decision 0143; the old address redirects here with a 308). A plan is a range:
 * its styles, their colourways, their sizes and the costs and margins from the factory's own tiers.
 *
 * Nothing on this page sells anything. "Create drop" inside a plan writes a payload for the Store to
 * collect; payments arrive with checkout (C1).
 */
export default async function CollectionsPage({ searchParams }: PageProps<"/orders/plans">) {
  const { brand } = await requireMember();
  const [plans, markets, facts] = await Promise.all([loadCollections(await sessionClient(), brand.id), loadMarkets(), loadFactoryFacts(marketOf((await searchParams).market))]);
  const canEdit = can(brand.role, "manageKit");

  return (
    <OrdersArea current="/orders/plans" discounts={facts.discounts}>
      <h2 className="sr-only">Collection plans</h2>
      <NewCollection markets={markets} canEdit={canEdit} />
      {plans.length === 0 ? (
        <EmptyState icon={<Icon icon={LayoutGrid} size={22} />} title="No collection plan yet">
          Name a plan above to start: a plan holds a range of styles, grouped by drop, priced from the factory&apos;s tiers.
        </EmptyState>
      ) : (
        <Table caption={`The collection plans of ${brand.name}`}>
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th>Landed in</Th>
              <Th>Styles</Th>
              <Th numeric>Planned</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <Tr key={plan.id}>
                <Td className="font-semibold">
                  <Link href={`/orders/plan/${plan.id}` as Route} className="text-text no-underline live:hover:underline">
                    {plan.name}
                  </Link>
                </Td>
                <Td>
                  {plan.destinationCountry} · {plan.currency}
                </Td>
                <Td>{styleWord(plan.styles)}</Td>
                <Td numeric>{pieces(plan.units)}</Td>
                <Td>{shortDate(plan.updatedAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </OrdersArea>
  );
}
