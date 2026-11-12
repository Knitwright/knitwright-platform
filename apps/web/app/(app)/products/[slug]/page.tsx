import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage } from "@/components/products/CategoryPage";
import { ProductPage } from "@/components/products/ProductPage";
import { marketFromQuery } from "@/lib/home/market";
import { readSlug } from "@/lib/products/routes";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Products" };

/**
 * `/products/<slug>` (plan v6 P4, decision 0142): a product (`/products/JSY-SS-01`, 09 screen 11) or a category
 * (`/products/football`, screen 22). The two cannot be confused: a product code always has the catalogue's code
 * shape. Anything else answers not found.
 */
export default async function ProductOrCategoryPage({ params, searchParams }: PageProps<"/products/[slug]">) {
  await requireMember();
  const slug = readSlug((await params).slug);
  if (slug === null) notFound();
  const query = await searchParams;
  const market = marketFromQuery(query.market);
  return slug.kind === "product" ? <ProductPage code={slug.code} market={market} /> : <CategoryPage slug={slug.slug} query={query} market={market} />;
}
