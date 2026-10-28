import { pageCount, pageOf, pageRequest } from "@/lib/pagination/pages";
import { SPORTS, STYLE_IDS, type ReviewState, type Sport, type StyleId } from "./catalogue";
import { COLOUR_FAMILIES, type ColourFamily } from "./colour-family";

/** How many templates one page of the library shows. */
export const TEMPLATES_PER_PAGE = 12;

/** What a row of the library needs to be listed. The design itself is read only for the page shown. */
export interface TemplateSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly sport: Sport;
  readonly articleId: string;
  readonly style: StyleId;
  readonly styleTags: readonly StyleId[];
  readonly colourFamily: ColourFamily;
  readonly reviewState: ReviewState;
  /** The designer's name, for a template a designer made. */
  readonly attribution?: string;
}

export interface TemplateFilters {
  readonly sport?: Sport;
  readonly article?: string;
  readonly style?: StyleId;
  readonly colour?: ColourFamily;
}

type SearchValue = string | string[] | undefined;

const first = (value: SearchValue): string | undefined => (Array.isArray(value) ? value[0] : value);
const ARTICLE_ID = /^[a-z0-9-]{1,64}$/;

const oneOf = <T extends string>(list: readonly T[], value: SearchValue): T | undefined => {
  const raw = first(value);
  return list.find((entry) => entry === raw);
};

/** The filters named in an address. A value that is not listed is left out, so a mistyped address still shows the library. */
export function filtersFromQuery(query: Readonly<Record<string, SearchValue>>): TemplateFilters {
  const article = first(query.article);
  const picked = {
    sport: oneOf(SPORTS, query.sport),
    article: article !== undefined && ARTICLE_ID.test(article) ? article : undefined,
    style: oneOf(STYLE_IDS, query.style),
    colour: oneOf(COLOUR_FAMILIES, query.colour),
  };
  return Object.fromEntries(Object.entries(picked).filter(([, value]) => value !== undefined)) as TemplateFilters;
}

/** The address of one page of the library with these filters. */
export function filterHref(path: string, filters: TemplateFilters, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export const applyFilters = (rows: readonly TemplateSummary[], filters: TemplateFilters): readonly TemplateSummary[] =>
  rows.filter(
    (row) =>
      (filters.sport === undefined || row.sport === filters.sport) &&
      (filters.article === undefined || row.articleId === filters.article) &&
      (filters.style === undefined || row.styleTags.includes(filters.style)) &&
      (filters.colour === undefined || row.colourFamily === filters.colour),
  );

interface TemplatePage {
  readonly rows: readonly TemplateSummary[];
  readonly total: number;
  readonly totalPages: number;
  readonly page: number;
}

/** One page of the templates that match, in the order given. */
export function listTemplates(all: readonly TemplateSummary[], filters: TemplateFilters, page: number): TemplatePage {
  const matches = applyFilters(all, filters);
  const request = pageRequest({ page: String(page) }, TEMPLATES_PER_PAGE);
  return { rows: pageOf(matches, request), total: matches.length, totalPages: pageCount(matches.length, TEMPLATES_PER_PAGE), page: request.page };
}

