import { z } from "zod";
import type { BaseArticleSummary } from "./types";
import { ARTICLE_STATUSES, PRODUCTION_CLASSES } from "./vocabulary";

/**
 * The catalogue's filters (spec F-S4 catalogue, F-S8): sport, article type, fit, gender, production class and fabric,
 * plus status. Every filter left out matches everything. An article whose fit or gender the build pack does not give
 * matches no fit or gender filter: it is never shown as something nobody said it is.
 */
export const catalogueFiltersSchema = z
  .object({
    sport: z.string().min(1).max(40).optional(),
    articleType: z.string().regex(/^[A-Z]{3}$/).optional(),
    fit: z.string().min(1).max(40).optional(),
    gender: z.string().min(1).max(40).optional(),
    productionClass: z.enum(PRODUCTION_CLASSES).optional(),
    fabric: z.string().regex(/^F-[A-Z0-9]+(-[A-Z0-9]+)*$/).optional(),
    status: z.enum(ARTICLE_STATUSES).optional(),
  })
  .strict();

export type CatalogueFilters = z.infer<typeof catalogueFiltersSchema>;

const has = (list: readonly string[], wanted: string | undefined): boolean => wanted === undefined || list.includes(wanted);
const is = (value: string | null, wanted: string | undefined): boolean => wanted === undefined || value === wanted;

export const matchesFilters = (article: BaseArticleSummary, filters: CatalogueFilters): boolean =>
  has(article.sportTags, filters.sport) &&
  is(article.articleType, filters.articleType) &&
  is(article.fit, filters.fit) &&
  has(article.genders, filters.gender) &&
  is(article.productionClass, filters.productionClass) &&
  has(article.fabricCodes, filters.fabric) &&
  is(article.status, filters.status);

/** The articles that pass every filter, in the order given. */
export const filterArticles = (articles: readonly BaseArticleSummary[], filters: CatalogueFilters): readonly BaseArticleSummary[] =>
  articles.filter((article) => matchesFilters(article, filters));
