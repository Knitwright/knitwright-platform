import type { CatalogueFilters } from "@/lib/catalogue";
import type { BaseArticleSummary } from "@/lib/catalogue/types";

/**
 * The catalogue's filter panel (spec F-S4: Sport, Article type, Fit, Gender, Production class,
 * Fabric, Style; F-S8). Every option comes from the rows the catalogue holds, with a count, so no
 * filter is offered that matches nothing and no value is shown that no article claims. Where a
 * field is set on no article yet, its group is left out and the panel says which ones those are.
 */

export const FILTER_KEYS = ["sport", "articleType", "fit", "gender", "productionClass", "fabric"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export interface FilterOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface FilterGroup {
  readonly key: FilterKey;
  readonly label: string;
  /** The name of the query field, which is the key itself. */
  readonly options: readonly FilterOption[];
}

export const FILTER_LABELS: Readonly<Record<FilterKey, string>> = {
  sport: "Sport",
  articleType: "Article type",
  fit: "Fit",
  gender: "Gender",
  productionClass: "Production class",
  fabric: "Fabric",
};

/** Knitwright's own words for a sport tag. An unknown tag is shown as it is stored. */
const SPORT_LABELS: Readonly<Record<string, string>> = {
  football: "Football",
  cricket: "Cricket",
  training: "Training",
  running: "Running",
  gym: "Gym",
  combat: "Combat",
  esports: "Esports",
  mma: "MMA",
  bjj: "BJJ",
  general: "Club and team wear",
};

/** Knitwright's own words for the article type in a code, as `JSY-SS-01` is a jersey. */
const ARTICLE_TYPE_LABELS: Readonly<Record<string, string>> = {
  JSY: "Jersey",
  SHO: "Shorts",
  CRK: "Cricket shirt",
  TEE: "Tee",
  HOD: "Hoodie",
  CMP: "Compression",
  FSH: "Fight shorts",
};

const FIT_LABELS: Readonly<Record<string, string>> = { regular: "Regular", slim: "Slim", compression: "Compression" };
const GENDER_LABELS: Readonly<Record<string, string>> = { men: "Men", women: "Women", unisex: "Unisex", kids: "Kids" };
const CLASS_LABELS: Readonly<Record<string, string>> = { A: "Class A", B: "Class B" };

/** What the panel says under the production class group: the build pack's words, labelled as its own. */
export const CLASS_NOTE =
  "Class A is sublimated and made from one piece. Class B is a small run, 50 to 300 a style. Both come from the build pack, not from a factory quote.";

const labelled = (map: Readonly<Record<string, string>>, value: string): string => map[value] ?? value;

const LABEL_OF: Readonly<Record<FilterKey, (value: string) => string>> = {
  sport: (value) => labelled(SPORT_LABELS, value),
  articleType: (value) => labelled(ARTICLE_TYPE_LABELS, value),
  fit: (value) => labelled(FIT_LABELS, value),
  gender: (value) => labelled(GENDER_LABELS, value),
  productionClass: (value) => labelled(CLASS_LABELS, value),
  fabric: (value) => value,
};

/** Every value of one field across the articles, each with how many articles carry it. */
const valuesOf = (articles: readonly BaseArticleSummary[], key: FilterKey): readonly string[][] =>
  articles.map((article) => {
    switch (key) {
      case "sport":
        return [...article.sportTags];
      case "articleType":
        return [article.articleType];
      case "fit":
        return article.fit === null ? [] : [article.fit];
      case "gender":
        return [...article.genders];
      case "productionClass":
        return [article.productionClass];
      case "fabric":
        return [...article.fabricCodes];
    }
  });

const countsOf = (articles: readonly BaseArticleSummary[], key: FilterKey): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const values of valuesOf(articles, key)) for (const value of new Set(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

/** The groups with at least one value, in the spec's order, each group's options by label. */
export function filterGroups(articles: readonly BaseArticleSummary[]): readonly FilterGroup[] {
  return FILTER_KEYS.map((key) => ({
    key,
    label: FILTER_LABELS[key],
    options: [...countsOf(articles, key)]
      .map(([value, count]) => ({ value, label: LABEL_OF[key](value), count }))
      .sort((a, b) => a.label.localeCompare(b.label, "en")),
  })).filter((group) => group.options.length > 0);
}

/** The groups no article has a value for, in words, or null when every group has one. */
export function emptyGroupsNote(articles: readonly BaseArticleSummary[]): string | null {
  const present = new Set(filterGroups(articles).map((group) => group.key));
  const missing = FILTER_KEYS.filter((key) => !present.has(key)).map((key) => FILTER_LABELS[key]);
  if (missing.length === 0) return null;
  return `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set on any base article yet, so ${missing.length === 1 ? "it is" : "they are"} not offered as a filter.`;
}

type QueryValue = string | readonly string[] | undefined;
export type Query = Readonly<Record<string, QueryValue>>;

const first = (value: QueryValue): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));

/**
 * The filters an address asks for, kept only where the catalogue really holds that value. A value
 * no article carries is dropped, so a mistyped or stale address shows the whole catalogue instead
 * of an empty grid.
 */
export function filtersFromQuery(query: Query, articles: readonly BaseArticleSummary[]): CatalogueFilters {
  const groups = filterGroups(articles);
  const picked: Record<string, string> = {};
  for (const group of groups) {
    const asked = first(query[group.key]);
    const found = group.options.find((option) => option.value === asked);
    if (found) picked[group.key] = found.value;
  }
  return picked as CatalogueFilters;
}

/** True where the article's name or code holds the words searched for. An empty search matches everything. */
export const matchesSearch = (article: BaseArticleSummary, search: string): boolean => {
  const wanted = search.trim().toLowerCase();
  if (wanted === "") return true;
  return `${article.name} ${article.code}`.toLowerCase().includes(wanted);
};

/** The search words an address asks for, trimmed and capped so a long address cannot be used as a payload. */
export const searchFromQuery = (query: Query): string => (first(query.q) ?? "").slice(0, 80);
