import type { Metadata } from "next";
import { PageIntro } from "@/components/shell/PageIntro";
import { ArticleGrid } from "@/components/studio/home/ArticleGrid";
import { CatalogueFilters } from "@/components/studio/home/CatalogueFilters";
import { CatalogueNav } from "@/components/studio/home/CatalogueNav";
import { TemplatesTab } from "@/components/studio/home/TemplatesTab";
import { getBaseArticle, listBaseArticles, matchesFilters } from "@/lib/catalogue";
import { emptyGroupsNote, filterGroups, filtersFromQuery, matchesSearch, searchFromQuery } from "@/lib/home/catalogue-filters";
import { articleCard, sortArticles, sortFromQuery, tabFromQuery } from "@/lib/home/catalogue-view";
import { marketFromQuery } from "@/lib/home/market";
import type { SellCurrency } from "@/lib/factory/schemas";
import { priceBook } from "@/lib/home/reads";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Base products and templates" };

/**
 * The base product and template catalogue (spec F-S4, "Base product and template catalogue";
 * F-S8). Base products come from X1's rows and their prices from X6's tiers; the Templates tab
 * lists the template library. Nothing here states a price or a lead time as a factory's word: each
 * one carries the label of the row it came from.
 */
export default async function CataloguePage({ searchParams }: PageProps<"/catalogue">) {
  await requireMember();
  const query = await searchParams;
  const tab = tabFromQuery(query.tab);
  const sort = sortFromQuery(query.sort);
  const market = marketFromQuery(query.market);
  const keep = { tab, sort, market: market.id };

  const summaries = await listBaseArticles(await sessionClient());
  const groups = filterGroups(summaries);
  const filters = filtersFromQuery(query, summaries);
  const search = searchFromQuery(query);

  return (
    <>
      <PageIntro
        eyebrow="Catalogue"
        title="Base products and templates"
        lead="Every base article Knitwright can make, with its fabrics, sizes and prices, and the templates to remix. Each base is a Knitwright draft until a factory reviews it."
      />
      <CatalogueNav tab={tab} sort={sort} market={market} query={{ ...keep, ...(search ? { q: search } : {}) }} />
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {tab === "bases" ? (
          <CatalogueFilters groups={groups} filters={filters} search={search} keep={keep} note={emptyGroupsNote(summaries)} />
        ) : (
          <div aria-hidden="true" />
        )}
        <div className="min-w-0">
          {tab === "bases" ? (
            <Bases summaries={summaries} filters={filters} search={search} sort={sort} currency={market.currency} />
          ) : (
            <TemplatesTab query={query} keep={keep} />
          )}
        </div>
      </div>
    </>
  );
}

type BasesProps = Readonly<{
  summaries: Awaited<ReturnType<typeof listBaseArticles>>;
  filters: ReturnType<typeof filtersFromQuery>;
  search: string;
  sort: ReturnType<typeof sortFromQuery>;
  currency: SellCurrency;
}>;

/**
 * The matching base articles as grid cards. Only the articles shown are read in full: the summary
 * carries no count of options, and the card needs one to mark an article whose form can be edited.
 */
async function Bases({ summaries, filters, search, sort, currency }: BasesProps) {
  const client = await sessionClient();
  const matched = summaries.filter((article) => matchesFilters(article, filters) && matchesSearch(article, search));
  const [book, articles] = await Promise.all([
    priceBook(),
    Promise.all(matched.map((article) => getBaseArticle(client, article.code))),
  ]);
  const cards = sortArticles(
    articles.filter((article): article is NonNullable<typeof article> => article !== null),
    sort,
  ).map((article) => articleCard(article, book.source(article.code), currency));

  return <ArticleGrid cards={cards} total={cards.length} factoryName={book.factoryName} />;
}
