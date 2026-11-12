import type { Route } from "next";
import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { MARKETS, marketHref, type Market } from "@/lib/home/market";

/**
 * The market and currency selector (spec F-S8: "UK | GBP, AU | AUD"), kept from the catalogue it replaces. Every
 * price on the page is shown in the chosen market's currency, from that currency's own column; nothing is converted.
 */
export function MarketNav({ path, query = {}, market }: Readonly<{ path: string; query?: Readonly<Record<string, string>>; market: Market }>) {
  return (
    <nav aria-label="Market and currency" className="inline-flex items-center gap-0.5 rounded-md bg-soft p-1">
      {MARKETS.map((entry) => {
        const on = entry.id === market.id;
        return (
          <Link
            key={entry.id}
            href={marketHref(path, query, entry) as Route}
            aria-current={on ? "true" : undefined}
            className={cx("flex h-8 items-center rounded-sm px-3 text-small font-medium no-underline", on ? "bg-bg text-text shadow-e1" : "text-text-2 hover:text-text")}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
