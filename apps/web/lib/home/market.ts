import type { SellCurrency } from "@/lib/factory/schemas";

/**
 * The market and currency selector of the catalogue and the article page (spec F-S8: "UK | GBP,
 * AU | AUD"). The two markets are the two `country_rules` rows that sell at launch (X6, decision
 * 0071); the country code is the one those rows use, so a lead time and a duty rule can be read
 * for the market the reader picked.
 */

export interface Market {
  readonly id: string;
  /** What the selector shows: "UK | GBP". */
  readonly label: string;
  /** The country of the `country_rules` row. */
  readonly country: string;
  readonly currency: SellCurrency;
}

export const MARKETS: readonly Market[] = [
  { id: "uk", label: "UK | GBP", country: "GB", currency: "GBP" },
  { id: "au", label: "AU | AUD", country: "AU", currency: "AUD" },
];

export const DEFAULT_MARKET: Market = MARKETS[0]!;

/** The market an address asks for. Anything else falls back to the UK, so a mistyped address still works. */
export const marketFromQuery = (value: string | readonly string[] | undefined): Market => {
  const asked = Array.isArray(value) ? value[0] : value;
  return MARKETS.find((market) => market.id === asked) ?? DEFAULT_MARKET;
};

/** The same address with another market chosen, keeping every other part of the query. */
export const marketHref = (path: string, query: Readonly<Record<string, string>>, market: Market): string => {
  const next = new URLSearchParams(query);
  next.set("market", market.id);
  return `${path}?${next.toString()}`;
};
