import { Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import { NoProducts, ProductSearch, ProductTable, StageChips } from "@/components/products/MyProducts";
import { LockedButton } from "@/components/products/LockedButton";
import { ProductsHeader } from "@/components/products/ProductsHeader";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { listProducts } from "@/lib/brand-runs/service";
import { MY_PRODUCTS_PATH } from "@/lib/products/routes";
import { productRows, stageChips, stageFromQuery } from "@/lib/products/mine";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "My products" };

/** The sales channels arrive with workstream C1; until then the button says so instead of opening nothing. */
const CHANNELS_COMING = "Sales channels can be connected once the store's channels arrive.";

/**
 * My products (plan v6 P4, decision 0142; 09 screen 10, prototype p05): the brand's products from
 * `brand_products`, by stage, with their channel column. Each row opens its design or its samples and runs.
 */
export default async function MyProductsPage({ searchParams }: PageProps<"/products/mine">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const stage = stageFromQuery(query.stage);
  const search = (Array.isArray(query.q) ? query.q[0] : query.q)?.slice(0, 80) ?? "";
  const products = await listProducts(await sessionClient(), brand.id);
  const rows = productRows(products, stage, search);

  return (
    <div className="flex flex-col gap-6 pb-16">
      <ProductsHeader
        title="My products"
        current={MY_PRODUCTS_PATH}
        actions={
          <>
            <LockedButton icon={<Icon icon={Store} size={20} />} reason={CHANNELS_COMING}>
              Connect a store
            </LockedButton>
            <LinkButton href="/orders/runs" icon={<Icon icon={Plus} size={20} />}>
              Create product
            </LinkButton>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StageChips chips={stageChips(products, search)} current={stage} />
        <ProductSearch stage={stage} search={search} />
      </div>
      {rows.length === 0 ? <NoProducts filtered={products.length > 0} /> : <ProductTable rows={rows} />}
    </div>
  );
}
