import { catalogue } from "@/lib/catalogue/fixtures/source";
import type { BaseArticle, BaseArticleSummary } from "@/lib/catalogue/types";
import { appTier, capabilityRows, colourRows, factoryRow, fabricRows } from "@/lib/factory/fixtures/rows";
import { toCapability, toColour, toFabric, toFactory } from "@/lib/factory/rows";
import type { Capability, FabricColour, Factory, ProgrammeFabric } from "@/lib/factory/schemas";
import type { PriceSource } from "@/lib/home/price";
import type { CardContext } from "../cards";

/** The launch catalogue and the factory test rows, for the Products tests and the /dev/products fixture page. */

/** A whole article read as the catalogue's summary of it (the summary is the article less its detail, plus codes). */
export const summaryOf = (article: BaseArticle): BaseArticleSummary => ({ ...article, fabricCodes: article.fabrics.map((fabric) => fabric.code) });

export const articles = (): readonly BaseArticle[] => catalogue();
export const summaries = (): readonly BaseArticleSummary[] => articles().map(summaryOf);
export const article = (code: string): BaseArticle => articles().find((one) => one.code === code)!;

export const LADDER = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

export const fabrics = (): readonly ProgrammeFabric[] => fabricRows.map(toFabric);
export const colours = (): readonly FabricColour[] => colourRows.map(toColour);
export const factory = (): Factory => toFactory(factoryRow);
export const capability = (): Capability => toCapability(capabilityRows[0]!);

/** JSY-SS-01 has the ladder and an order of one; everything else has nothing on file. */
export const source = (code: string): PriceSource => (code === "JSY-SS-01" ? { ladder: LADDER, moq: 1 } : { ladder: [], moq: null });

export const context = (overrides: Partial<CardContext> = {}): CardContext => ({
  source,
  fabrics: fabrics(),
  colours: colours(),
  factoryCity: "Sialkot",
  currency: "GBP",
  ...overrides,
});
