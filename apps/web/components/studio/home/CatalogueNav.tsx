import type { Route } from "next";
import Link from "next/link";
import { CATALOGUE_TABS, SORT_NOTE, SORTS, type CatalogueTab, type SortId } from "@/lib/home/catalogue-view";
import { MARKETS, type Market } from "@/lib/home/market";

/**
 * The catalogue's two tabs, its sort and its market selector (spec F-S4 tabs and sort, F-S8 market
 * and currency). The tabs and the markets are links, so each state has its own address and both are
 * reachable by keyboard without a script; the sort is a plain form that reloads the page.
 */

const PILL = "nav-pill inline-flex min-h-10 items-center rounded-full border px-4 text-[14.5px] no-underline";

const chosen = (on: boolean): string => (on ? "border-white/25 bg-white/12 text-white" : "border-white/12 text-muted");

type NavProps = Readonly<{
  tab: CatalogueTab;
  sort: SortId;
  market: Market;
  /** Every other part of the address, so a tab, a sort or a market keeps the filters. */
  query: Readonly<Record<string, string>>;
}>;

const hrefWith = (query: Readonly<Record<string, string>>, changes: Readonly<Record<string, string>>): Route => {
  const next = new URLSearchParams({ ...query, ...changes });
  return `/catalogue?${next.toString()}` as Route;
};

export function CatalogueNav({ tab, sort, market, query }: NavProps) {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Catalogue sections" className="flex flex-wrap gap-2">
        {CATALOGUE_TABS.map((entry) => (
          <Link
            key={entry.id}
            href={hrefWith(query, { tab: entry.id })}
            aria-current={entry.id === tab ? "page" : undefined}
            className={`${PILL} ${chosen(entry.id === tab)}`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form method="get" action="/catalogue" className="flex flex-wrap items-end gap-2">
          {Object.entries(query)
            .filter(([key]) => key !== "sort")
            .map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
          <label htmlFor="catalogue-sort" className="sr-only">
            Sort
          </label>
          <select
            id="catalogue-sort"
            name="sort"
            defaultValue={sort}
            className="h-10 rounded-full border border-hairline bg-white/[0.04] px-4 text-[14.5px] text-ink focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
          >
            {SORTS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <button type="submit" className="chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-sm font-medium text-ink">
            Sort
          </button>
        </form>
        <nav aria-label="Market and currency" className="flex flex-wrap gap-2">
          {MARKETS.map((entry) => (
            <Link
              key={entry.id}
              href={hrefWith(query, { market: entry.id })}
              aria-current={entry.id === market.id ? "true" : undefined}
              className={`${PILL} ${chosen(entry.id === market.id)}`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-[13px] text-muted">{SORT_NOTE}</p>
    </div>
  );
}
