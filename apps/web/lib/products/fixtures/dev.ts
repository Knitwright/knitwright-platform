import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProductView } from "@/lib/brand-runs/service";
import type { BaseArticle, BaseArticleSummary } from "@/lib/catalogue/types";
import { launchCatalogue } from "@/lib/catalogue/seed/launch";
import { appTier } from "@/lib/factory/fixtures/rows";
import type { PriceSource } from "@/lib/home/price";
import type { TemplateSummary } from "@/lib/templates/filters";
import type { CardContext } from "../cards";

/**
 * FIXTURE ONLY: the data the /dev/products page draws with, for the 1440 × 900 comparison with the prototype
 * renders without a database. The catalogue is the real launch catalogue, read from the spec's article file the way
 * the seed reads it; the prices are the build pack's placeholder ladder on the worked article only; the products
 * and the ideas are made up and say so.
 */

export const devArticles = (): readonly BaseArticle[] =>
  launchCatalogue(JSON.parse(readFileSync(join(process.cwd(), "..", "..", "docs", "spec", "articles", "JSY-SS-01", "article.json"), "utf8")));

export const devSummaries = (): readonly BaseArticleSummary[] => devArticles().map((article) => ({ ...article, fabricCodes: article.fabrics.map((fabric) => fabric.code) }));

const LADDER = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

export const devSource = (code: string): PriceSource => (code === "JSY-SS-01" ? { ladder: LADDER, moq: 1 } : { ladder: [], moq: null });

export const devContext: CardContext = { source: devSource, fabrics: [], colours: [], factoryCity: "Sialkot", currency: "GBP" };

const product = (id: string, name: string, stage: ProductView["stage"], createdAt: string): ProductView => ({
  id,
  projectId: `00000000-0000-4000-8000-00000000000${id}`,
  name,
  stage,
  designVersion: 3,
  createdAt,
  runs: [],
});

export const DEV_PRODUCTS: readonly ProductView[] = [
  product("1", "Made-up home shirt 2027", "run", "2026-11-12T09:00:00Z"),
  product("2", "Made-up away shirt 2027", "sample", "2026-11-11T09:00:00Z"),
  product("3", "Made-up GK jersey", "idea", "2026-11-03T09:00:00Z"),
  product("4", "Made-up training shorts", "idea", "2026-11-01T09:00:00Z"),
];

const idea = (id: string, title: string, sport: TemplateSummary["sport"]): TemplateSummary => ({
  id,
  slug: id,
  title,
  sport,
  articleId: "football-shirt",
  style: "plain",
  styleTags: ["plain"],
  colourFamily: "blue",
  reviewState: "not_reviewed",
});

export const DEV_IDEAS: readonly TemplateSummary[] = [
  idea("i1", "Made-up retro collar", "football"),
  idea("i2", "Made-up pinstripe", "cricket"),
  idea("i3", "Made-up charity kit", "general"),
  idea("i4", "Made-up gradient sleeves", "football"),
  idea("i5", "Made-up camo training", "training"),
  idea("i6", "Made-up minimal crest", "running"),
];
