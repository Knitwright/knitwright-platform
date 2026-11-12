import type { Metadata } from "next";
import { CatalogueSearch, SwatchBookButton } from "@/components/products/Coming";
import { CardRow, CategoryTiles, Discover, EcoBand, ProBanner, Questions } from "@/components/products/HomeSections";
import { MarketNav } from "@/components/products/MarketNav";
import { ProductsHeader } from "@/components/products/ProductsHeader";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import { marketFromQuery } from "@/lib/home/market";
import { productCards } from "@/lib/products/cards";
import { categoriesOf, inCategory } from "@/lib/products/categories";
import { discoverLinks, faqs, homeRows, longestLeadTime } from "@/lib/products/home";
import { ALL_CATEGORY, categoryHref, PRODUCTS_PATH, productHref } from "@/lib/products/routes";
import { cardContext, loadProducts, type ProductsData } from "@/lib/products/server";
import { requireMember } from "@/lib/server/page-guards";
import { Package } from "lucide-react";

export const metadata: Metadata = { title: "Catalogue" };

/**
 * The catalogue home (plan v6 P4, decision 0142; 09 screen 10, prototype p01): search and Order swatch book, the
 * category tiles, the Studio Pro banner, Top picks, From one piece, Eco picks, Discover more and the questions.
 * Every row is chosen from the catalogue's rows and every price comes from the factory's tiers.
 */
export default async function CataloguePage({ searchParams }: PageProps<"/products">) {
  await requireMember();
  const market = marketFromQuery((await searchParams).market);
  const data = await loadProducts(market);
  const query: Readonly<Record<string, string>> = market.id === "uk" ? {} : { market: market.id };

  return (
    <div className="flex flex-col gap-10 pb-16">
      <ProductsHeader
        title="Catalogue"
        current={PRODUCTS_PATH}
        actions={
          <>
            <CatalogueSearch />
            <SwatchBookButton />
          </>
        }
      />
      <div className="-mt-6 flex justify-end">
        <MarketNav path={PRODUCTS_PATH} market={market} />
      </div>
      {data.articles.length === 0 ? (
        <EmptyState icon={<Icon icon={Package} size={22} />} title="The catalogue is empty">
          No base article is in the catalogue yet. Bases appear here as Knitwright adds them.
        </EmptyState>
      ) : (
        <HomeBody data={data} market={market} query={query} />
      )}
    </div>
  );
}

type BodyProps = Readonly<{ data: ProductsData; market: ReturnType<typeof marketFromQuery>; query: Readonly<Record<string, string>> }>;

function HomeBody({ data, market, query }: BodyProps) {
  const context = cardContext(data, market);
  const rows = homeRows(data.articles, context.source, data.book.fabrics);
  const cards = (list: typeof data.articles) => productCards(list, context);
  const typeOf = (slug: string) => inCategory(data.articles, slug).find((article) => article.registryTypeId !== null)?.registryTypeId ?? null;
  const first = rows.topPicks[0] ?? data.articles[0];
  const leadTimeDays = longestLeadTime(data.articles, (code) => data.book.capability(code)?.leadTimeDays ?? null);

  return (
    <>
      <CategoryTiles categories={categoriesOf(data.articles).slice(0, 6)} typeOf={typeOf} />
      <ProBanner lead={bannerLead(data)} start={first ? productHref(first.code) : null} typeIds={data.articles.map((article) => article.registryTypeId).filter(Boolean)} />
      <CardRow id="top-picks" title="Top picks for clubs" cards={cards(rows.topPicks)} viewAll={categoryHref(ALL_CATEGORY, query)} />
      <CardRow id="one-piece" title="From one piece" cards={cards(rows.onePiece)} viewAll={categoryHref(ALL_CATEGORY, query)} />
      <EcoBand cards={cards(rows.eco)} />
      <Discover links={discoverLinks(data.articles)} />
      <Questions faqs={faqs({ articles: data.articles, source: context.source, leadTimeDays, qcDays: data.qcDays, freightDays: data.freightDays })} />
    </>
  );
}

/** "Sublimated in Sialkot, from 1 piece. Studio Pro pricing is not set yet." Every part from a row. */
function bannerLead(data: ProductsData): string {
  const moqs = data.articles.map((article) => data.book.source(article.code).moq).filter((moq): moq is number => moq !== null);
  const where = data.factory ? `Sublimated in ${data.factory.city}` : "Sublimated by Knitwright's factory partner";
  const from = moqs.length === 0 ? "" : `, from ${Math.min(...moqs)} piece${Math.min(...moqs) === 1 ? "" : "s"}`;
  return `${where}${from}. Names and numbers are designed in the editor. Studio Pro pricing is not set yet.`;
}
