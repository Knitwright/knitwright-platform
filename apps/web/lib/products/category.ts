import { matchesFilters, type CatalogueFilters } from "@/lib/catalogue";
import type { BaseArticleSummary } from "@/lib/catalogue/types";
import { filterGroups, filtersFromQuery, matchesSearch, searchFromQuery, type FilterGroup, type Query } from "@/lib/home/catalogue-filters";
import { sortArticles, sortFromQuery, SORTS, type SortId } from "@/lib/home/catalogue-view";
import { pageCount, readPage } from "@/lib/pagination/pages";
import { inCategory } from "./categories";

/**
 * The category page's filter bar and grid (09 screen 22; prototype p02): Sport, Decoration, Fit, Fabric,
 * Production class, Price and Sort, a 4-column grid and a pager.
 *
 * The filters are the catalogue's own (`lib/home/catalogue-filters.ts`): every option is a value some article in the
 * category holds, with its count. Decoration and Price have no column on any base article yet (the decoration
 * methods are not rows, and a price band would need every base priced), so the bar shows them switched off with the
 * reason, rather than offering a filter that matches nothing.
 */

export const PER_PAGE = 16;

/** The filters the bar offers, in the spec's order. Article type is the sub-category chips above the bar. */
const BAR_KEYS = ["sport", "fit", "fabric", "productionClass"] as const;

export type BarGroup = FilterGroup & Readonly<{ chosen: string | null }>;

export type UnavailableFilter = Readonly<{ label: string; reason: string }>;

export const UNAVAILABLE_FILTERS: readonly UnavailableFilter[] = [
  { label: "Decoration", reason: "No base article lists its decoration methods yet." },
  { label: "Price", reason: "A price filter needs every base priced; most have no price set yet." },
];

export interface CategoryView {
  readonly bar: readonly BarGroup[];
  readonly articleType: string | null;
  readonly search: string;
  readonly sort: SortId;
  readonly sorts: typeof SORTS;
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
  readonly articles: readonly BaseArticleSummary[];
  /** The query that keeps every choice, for the pager and the sub-category chips. */
  readonly keep: Readonly<Record<string, string>>;
}

const chosenOf = (filters: CatalogueFilters, key: string): string | null =>
  (filters as Readonly<Record<string, string | undefined>>)[key] ?? null;

export function categoryView(all: readonly BaseArticleSummary[], slug: string, query: Query): CategoryView {
  const pool = inCategory(all, slug);
  const filters = filtersFromQuery(query, pool);
  const search = searchFromQuery(query);
  const sort = sortFromQuery(query.sort);
  const matched = sortArticles(
    pool.filter((article) => matchesFilters(article, filters) && matchesSearch(article, search)),
    sort,
  );
  const totalPages = pageCount(matched.length, PER_PAGE);
  const page = Math.min(readPage(query.page as string | string[] | undefined), totalPages);
  const keep: Record<string, string> = { ...(filters as Record<string, string>), ...(search ? { q: search } : {}) };
  if (sort !== "name") keep.sort = sort;
  return {
    bar: filterGroups(pool)
      .filter((group) => (BAR_KEYS as readonly string[]).includes(group.key))
      .map((group) => ({ ...group, chosen: chosenOf(filters, group.key) })),
    articleType: filters.articleType ?? null,
    search,
    sort,
    sorts: SORTS,
    total: matched.length,
    page,
    totalPages,
    articles: matched.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    keep,
  };
}
