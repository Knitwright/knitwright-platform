import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SelectSizes } from "@/components/make/SelectSizes";
import { FormPage } from "@/components/shell/PageIntro";
import { can } from "@/lib/clubs/roles";
import { marketOf } from "@/lib/make/market";
import { loadMake, loadOrderProducts } from "@/lib/make/server";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Select sizes" };

const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/**
 * The order modal of F-S7, as a page: search your own products, filter them, type the pieces per size, and hand
 * the order over to production. There is no checkout and no payment anywhere on it (owner decision 1).
 */
export default async function OrderPage({ params, searchParams }: PageProps<"/studio/[projectId]/make/order">) {
  const member = await requireMember();
  const { projectId } = await params;
  const market = marketOf((await searchParams).market);
  const client = await sessionClient();
  const context = await loadMake(client, member.brand.id, projectId, market).catch(orNotFound);
  const products = await loadOrderProducts(client, member.brand.id, market);

  return (
    <FormPage
      eyebrow={`${context.designName} · make`}
      title="Select sizes"
      lead={
        <>
          Pieces per product and size. The tier price is read across every piece in the order, so it changes as the quantities do. The order is
          handed to production; Knitwright invoices it outside this platform.{" "}
          <Link href={`/studio/${projectId}/make` as Route} className="soft-link text-cobalt-soft">Back to the product</Link>.
        </>
      }
    >
      <SelectSizes products={products} currency={market} canOrder={can(member.brand.role, "manageKit")} deliveryText={context.delivery.text} />
    </FormPage>
  );
}
