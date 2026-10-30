import { SELL_CURRENCIES, type SellCurrency } from "@/lib/factory/schemas";

/**
 * Which market a page is shown in: the United Kingdom in pounds or Australia in Australian dollars (spec F-S8).
 * Anything else is the United Kingdom, because a price is only ever shown in a currency the tiers hold.
 */
export const DEFAULT_MARKET: SellCurrency = "GBP";

export const marketOf = (value: string | readonly string[] | undefined): SellCurrency => {
  const wanted = Array.isArray(value) ? value[0] : value;
  return SELL_CURRENCIES.find((currency) => currency === wanted) ?? DEFAULT_MARKET;
};
