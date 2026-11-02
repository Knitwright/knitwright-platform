import "server-only";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import { factoryStore } from "@/lib/factory/server";
import type { PriceSource } from "@/lib/home/price";
import type { Market } from "@/lib/home/market";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { marketSummary, type MarketSummary } from "./view";

/**
 * Joins the market summary to the market's own row, the production settings and the article's price
 * ladder (decision 0104). It holds no rules of its own: `view.ts` and `tax.ts` have those and are
 * tested, and the database and end-to-end tests cover the joining.
 *
 * A read that fails is a market with nothing shown, never a page that will not open: the summary says
 * the rules could not be read and names it as a gap.
 */
export async function loadMarketSummary(
  market: Market,
  price: PriceSource,
  leadTimeDays: number | null,
): Promise<MarketSummary> {
  const [rule, qcDays] = await Promise.all([ruleFor(market), qcDaysOf()]);
  return marketSummary({ market, rule, price, leadTimeDays, qcDays });
}

const ruleFor = async (market: Market) => {
  try {
    const rules = await factoryStore().listCountryRules();
    return rules.find((rule) => rule.country === market.country) ?? null;
  } catch (error) {
    log({ level: "warn", message: "A market's rules could not be read", where: "market summary", error });
    return null;
  }
};

const qcDaysOf = async (): Promise<number | null> => (await loadProductionSettings(adminClient())).qcDays;
