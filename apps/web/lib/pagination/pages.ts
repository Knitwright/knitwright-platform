/**
 * Long lists are split into pages. The page number travels in the address as `?page=2`;
 * the first page has no number. Anything that is not a whole number from 1 up reads as
 * page 1, so a mistyped address still shows something.
 */

/** The highest page number read from an address. Beyond it a list is not worth paging. */
export const MAX_PAGE = 10_000;

export interface PageRequest {
  readonly page: number;
  readonly perPage: number;
  /** How many rows come before this page. */
  readonly offset: number;
}

type SearchValue = string | string[] | undefined;

/** The page asked for in the address. The first value wins when `page` is given twice. */
export const readPage = (value: SearchValue): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || !/^\d{1,6}$/.test(raw)) return 1;
  const page = Number(raw);
  return page < 1 ? 1 : Math.min(page, MAX_PAGE);
};

/** The page and rows wanted, from the address's search values. */
export const pageRequest = (
  searchParams: Readonly<Record<string, SearchValue>>,
  perPage: number,
): PageRequest => {
  const page = readPage(searchParams.page);
  return { page, perPage, offset: (page - 1) * perPage };
};

/** How many pages a list of `total` rows fills. An empty list still has one page. */
export const pageCount = (total: number, perPage: number): number =>
  Math.max(1, Math.ceil(Math.max(0, total) / perPage));

/** The rows of one page of a list that is already in memory. */
export const pageOf = <T>(rows: readonly T[], request: PageRequest): readonly T[] =>
  rows.slice(request.offset, request.offset + request.perPage);

export type PageMark = number | "gap";

/**
 * The page numbers to show: always the first and last, the current page and its
 * neighbours, and a gap where numbers are left out. Seven or fewer pages are all shown.
 */
export const pageMarks = (current: number, total: number): readonly PageMark[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const near = [1, current - 1, current, current + 1, total].filter((page) => page >= 1 && page <= total);
  const unique = [...new Set(near)].sort((a, b) => a - b);
  return unique.flatMap((page, index): PageMark[] => {
    const before = unique[index - 1];
    if (before === undefined || page - before === 1) return [page];
    return page - before === 2 ? [before + 1, page] : ["gap", page];
  });
};

/** The address of a page of a list. Page 1 is the list's own address. */
export const pageHref = (path: string, page: number): string => (page <= 1 ? path : `${path}?page=${page}`);
