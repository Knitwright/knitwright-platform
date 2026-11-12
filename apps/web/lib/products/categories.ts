import type { BaseArticleSummary } from "@/lib/catalogue/types";
import { filterGroups, type FilterOption } from "@/lib/home/catalogue-filters";
import { ALL_CATEGORY } from "./routes";

/**
 * The catalogue's categories (09 screens 10 and 22). The prototype's six tiles are by wearer (Men's, Women's, Kids')
 * and by use, but no base article holds a gender yet (decision 0090: the build pack gives none), so a Men's tile
 * would open an empty page for every one of them. The categories are the sports the articles are tagged with, read
 * from the rows with their counts, plus "All products". A sport no article carries is never offered.
 */

export interface Category {
  readonly slug: string;
  readonly label: string;
  readonly count: number;
}

/** "Football" for the sport tag `football`, from the catalogue's own words. */
const sportOptions = (articles: readonly BaseArticleSummary[]): readonly FilterOption[] =>
  filterGroups(articles).find((group) => group.key === "sport")?.options ?? [];

/** Every category with at least one article, most articles first, then by name. */
export function categoriesOf(articles: readonly BaseArticleSummary[]): readonly Category[] {
  return [...sportOptions(articles)]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"))
    .map((option) => ({ slug: option.value, label: option.label, count: option.count }));
}

/** The category a slug names, or null when the catalogue holds no article in it. */
export function findCategory(articles: readonly BaseArticleSummary[], slug: string): Category | null {
  if (slug === ALL_CATEGORY) return { slug, label: "All products", count: articles.length };
  return categoriesOf(articles).find((category) => category.slug === slug) ?? null;
}

/** The articles of a category, in the order given. */
export const inCategory = (articles: readonly BaseArticleSummary[], slug: string): readonly BaseArticleSummary[] =>
  slug === ALL_CATEGORY ? articles : articles.filter((article) => article.sportTags.includes(slug));

export interface SubCategory {
  /** The article type of the code, as `JSY`. */
  readonly type: string;
  readonly label: string;
  readonly count: number;
}

/** The sub-category chips of a category page: the article types inside it, with their counts. */
export function subCategoriesOf(articles: readonly BaseArticleSummary[]): readonly SubCategory[] {
  const types = filterGroups(articles).find((group) => group.key === "articleType")?.options ?? [];
  return types.map((option) => ({ type: option.value, label: option.label, count: option.count }));
}
