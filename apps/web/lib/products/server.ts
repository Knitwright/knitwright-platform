import "server-only";
import { listBaseArticles } from "@/lib/catalogue";
import type { BaseArticleSummary } from "@/lib/catalogue/types";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import type { Factory } from "@/lib/factory/schemas";
import { factoryStore } from "@/lib/factory/server";
import type { PriceBook } from "@/lib/home/book";
import type { Market } from "@/lib/home/market";
import { priceBook } from "@/lib/home/reads";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import type { CardContext } from "./cards";

/**
 * Joins the Products pages to the database: the catalogue's rows through the member's own client, and the factory
 * model (prices, fabrics, colours, the factory row, QC days and the market's freight days) through the server's,
 * as decision 0071 asks. A failed factory read never stops a page: its prices then read "not set yet".
 */

export interface ProductsData {
  readonly articles: readonly BaseArticleSummary[];
  readonly book: PriceBook;
  readonly factory: Factory | null;
  readonly qcDays: number | null;
  readonly freightDays: number | null;
}

async function factoryFacts(market: Market): Promise<Pick<ProductsData, "factory" | "qcDays" | "freightDays">> {
  try {
    const store = factoryStore();
    const [factories, rules, settings] = await Promise.all([store.listFactories(), store.listCountryRules(), loadProductionSettings(adminClient())]);
    const rule = rules.find((one) => one.country === market.country && one.sellingEnabled) ?? null;
    return { factory: factories[0] ?? null, qcDays: settings.qcDays, freightDays: rule?.freightDays ?? null };
  } catch (error) {
    log({ level: "warn", message: "The factory facts could not be read", where: "products", error });
    return { factory: null, qcDays: null, freightDays: null };
  }
}

export async function loadProducts(market: Market): Promise<ProductsData> {
  const [articles, book, facts] = await Promise.all([listBaseArticles(await sessionClient()), priceBook(), factoryFacts(market)]);
  return { articles, book, ...facts };
}

export const cardContext = (data: ProductsData, market: Market): CardContext => ({
  source: (code) => data.book.source(code),
  fabrics: data.book.fabrics,
  colours: data.book.colours,
  factoryCity: data.factory?.city ?? null,
  currency: market.currency,
});
