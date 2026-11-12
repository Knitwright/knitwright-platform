import { Shirt } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { OrdersArea } from "@/components/order-desk/OrdersArea";
import { Tag } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { listProducts } from "@/lib/brand-runs/service";
import { marketOf } from "@/lib/make/market";
import { shortDate } from "@/lib/order-desk/format";
import { loadFactoryFacts } from "@/lib/order-desk/server";
import { listGolden } from "@/lib/order-desk/service";
import { sampleEntries } from "@/lib/order-desk/views";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Samples" };

/**
 * Samples (09 screen 15, decision 0143): every sample ordered and every golden sample judged, from the
 * make flow's own records. Each row opens the design's sample or golden-sample page.
 */
export default async function SamplesPage({ searchParams }: PageProps<"/orders/samples">) {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const [products, golden, facts] = await Promise.all([listProducts(client, brand.id), listGolden(client, brand.id), loadFactoryFacts(marketOf((await searchParams).market))]);
  const entries = sampleEntries(products, golden);

  return (
    <OrdersArea current="/orders/samples" discounts={facts.discounts}>
      {entries.length === 0 ? (
        <EmptyState icon={<Icon icon={Shirt} size={22} />} title="No samples yet" action={<LinkButton href="/orders/runs">Order a sample</LinkButton>}>
          A sample is one piece per size, made before a run. Order one from Product runs or a design&apos;s Make page.
        </EmptyState>
      ) : (
        <Table caption="Samples and golden samples, newest first">
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Kind</Th>
              <Th>Sizes or version</Th>
              <Th>Status</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Tr key={entry.id}>
                <Td className="font-semibold">
                  <Link href={entry.href as Route} className="text-text no-underline live:hover:underline">
                    {entry.productName}
                  </Link>
                </Td>
                <Td>
                  <Tag tone={entry.kind === "golden" ? "beta" : "neutral"}>{entry.kind === "golden" ? "Golden sample" : "Sample"}</Tag>
                </Td>
                <Td>{entry.detail}</Td>
                <Td>{entry.status}</Td>
                <Td>{shortDate(entry.at)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </OrdersArea>
  );
}
