import type { Route } from "next";
import Link from "next/link";
import { SearchInput } from "@/components/ui/Inputs";
import { cx } from "@/components/ui/cx";
import { FILTERS, type FilterId } from "@/lib/order-desk/status";

const hrefOf = (filter: FilterId, query: string): Route => {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (query !== "") params.set("q", query);
  const text = params.toString();
  return (text === "" ? "/orders" : `/orders?${text}`) as Route;
};

/**
 * The status chips and the search (08 v3.5). Each chip is a link, so a filtered list has its own
 * address; the search is a plain form that reloads the page with `?q=`, so it works without script.
 */
export function OrderFilters({ filter, query }: Readonly<{ filter: FilterId; query: string }>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Order status" className="flex flex-wrap gap-2">
        {FILTERS.map((chip) => (
          <Link
            key={chip.id}
            href={hrefOf(chip.id, query)}
            aria-current={chip.id === filter ? "page" : undefined}
            className={cx(
              "inline-flex h-9 items-center rounded-full border px-4 text-body font-medium whitespace-nowrap no-underline transition-colors duration-fast",
              chip.id === filter ? "border-navy bg-navy text-on-dark" : "border-border bg-bg text-text-2 live:hover:bg-soft",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </nav>
      <form role="search" action="/orders" className="w-full max-w-xs">
        {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
        <SearchInput name="q" defaultValue={query} maxLength={80} placeholder="Order, customer, product" aria-label="Search orders" />
      </form>
    </div>
  );
}
