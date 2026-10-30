import type { BaseArticle } from "../types";
import { baseArticleFromJson, type ArticleJsonExtras } from "./article-json";
import { baseArticleFromDraftJson, BUNDLED_DRAFT_ARTICLES } from "./draft-article";

/**
 * The eight launch articles (docs/spec/articles/ONBOARDING.md). Each one is read from the `article.json` committed
 * with the spec: JSY-SS-01 from the worked article, the other seven from the briefs of plan v5 workstream Z9
 * (decision 0090), where every value carries the published source it was read from:
 * - code, name, class and uses ("Serves"): ONBOARDING.md, "How many base articles";
 * - sport tags: only the sports named in the article's row of 01-product-direction.md, "Launch catalogue";
 * - fabric codes: the programme code in that same row.
 * The build pack gives none of the seven a size range, so it is empty, and so are their points of measure, ranges,
 * options and construction. Nothing is filled in to look complete.
 */

/** JSY-SS-01's name says "regular fit"; the file names no gender, so none is set. */
export const JSY_SS_01_EXTRAS: ArticleJsonExtras = { fit: "regular", genders: [] };

/** The seven articles still in draft, in onboarding order, from their briefs. */
export const DRAFT_ARTICLES: readonly BaseArticle[] = BUNDLED_DRAFT_ARTICLES.map(baseArticleFromDraftJson);

/** The whole launch catalogue, JSY-SS-01 first, from the contents of its article.json. */
export const launchCatalogue = (jsySs01Json: unknown): readonly BaseArticle[] => [
  baseArticleFromJson(jsySs01Json, JSY_SS_01_EXTRAS),
  ...DRAFT_ARTICLES,
];
