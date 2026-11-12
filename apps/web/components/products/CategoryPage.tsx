import { SearchX } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Query } from "@/lib/home/catalogue-filters";
import type { Market } from "@/lib/home/market";
import { productCards } from "@/lib/products/cards";
import { findCategory, inCategory, subCategoriesOf } from "@/lib/products/categories";
import { categoryView } from "@/lib/products/category";
import { categoryHref } from "@/lib/products/routes";
import { cardContext, loadProducts } from "@/lib/products/server";
import { CategoryHero, FilterBar, Pager, SubCategoryChips } from "./CategoryParts";
import { MarketNav } from "./MarketNav";
import { ProductGrid } from "./ProductTile";

/**
 * A category page (plan v6 P4, decision 0142; 09 screen 22, prototype p02): the hero, the product-type chips, the
 * filter bar, a 4-column grid and the pager. A category no article is in answers not found.
 */
export async function CategoryPage({ slug, query, market }: Readonly<{ slug: string; query: Query; market: Market }>) {
  const data = await loadProducts(market);
  const category = findCategory(data.articles, slug);
  if (!category) notFound();
  const pool = inCategory(data.articles, slug);
  const view = categoryView(data.articles, slug, query);
  const typeOf = (type: string) => pool.find((article) => article.articleType === type && article.registryTypeId !== null)?.registryTypeId ?? null;
  const cards = productCards(view.articles, cardContext(data, market));

  return (
    <div className="flex flex-col gap-6 pb-16">
      <CategoryHero category={category} typeId={pool.find((article) => article.registryTypeId !== null)?.registryTypeId ?? null} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SubCategoryChips slug={slug} subs={subCategoriesOf(pool)} chosen={view.articleType} keep={view.keep} typeOf={typeOf} />
        <MarketNav path={categoryHref(slug)} query={view.keep} market={market} />
      </div>
      <FilterBar slug={slug} view={view} />
      <p className="text-body text-muted" role="status">
        {`${view.total} base product${view.total === 1 ? "" : "s"}${view.search ? ` matching "${view.search}"` : ""}`}
      </p>
      {cards.length === 0 ? (
        <EmptyState
          icon={<Icon icon={SearchX} size={22} />}
          title="No product matches these filters"
          action={<LinkButton href={categoryHref(slug)}>Clear filters</LinkButton>}
        >
          Try fewer filters, or another category.
        </EmptyState>
      ) : (
        <ProductGrid cards={cards} label="Base products" />
      )}
      <Pager slug={slug} view={view} />
    </div>
  );
}
