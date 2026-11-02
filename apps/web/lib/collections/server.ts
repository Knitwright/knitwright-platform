import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBaseArticle } from "@/lib/catalogue";
import type { FactorySnapshot } from "@/lib/factory/schemas";
import { factoryStore } from "@/lib/factory/server";
import { listProducts, type ProductView } from "@/lib/brand-runs/service";
import { loadIllustrations } from "@/lib/images/illustrations";
import { latestImages } from "@/lib/images/service";
import { createFileReader } from "@/lib/storage/read";
import { articleCodesOf, emptySource, pricingFor, type RatesSource } from "./pricing";
import { listCollections, listFreightRates, loadPlan } from "./service";
import type { CollectionPlan, CollectionSummary, PricingByStyle } from "./types";

/**
 * Joins the collection screens to the database: the plan, the brand's products, the factory tiers, the
 * destination's country rule and the freight row. It holds no rules of its own -- `line-plan.ts`,
 * `landed.ts` and `board.ts` have those and are tested -- and it reads the factory model with the
 * server's own key, as decision 0071 asks.
 */

/** The one factory on file (decision 0071 seeds a single placeholder), with its capabilities and tiers. */
async function snapshotOfFactory(): Promise<FactorySnapshot | null> {
  const store = factoryStore();
  const factories = await store.listFactories();
  const factory = [...factories].sort((a, b) => a.slug.localeCompare(b.slug))[0] ?? null;
  return factory ? store.snapshot(factory) : null;
}

/** The duty rates, freight row and HS codes that apply to this plan's destination. */
async function ratesSourceOf(client: SupabaseClient, plan: CollectionPlan): Promise<RatesSource> {
  const [rules, freightRates, articles] = await Promise.all([
    factoryStore().listCountryRules(),
    listFreightRates(client),
    Promise.all(articleCodesOf(plan.styles).map(async (code) => [code, (await getBaseArticle(client, code))?.hsCode ?? null] as const)),
  ]);
  const rule = rules.find((one) => one.country === plan.destinationCountry) ?? null;
  const freight = freightRates.find((one) => one.country === plan.destinationCountry) ?? null;
  return {
    ...emptySource(plan.destinationCountry),
    freight,
    dutyByHs: rule?.dutyByHs ?? {},
    countryLabel: rule?.label ?? null,
    countryRuleId: rule?.ruleId ?? null,
    hsByArticle: Object.fromEntries(articles),
  };
}

export interface PlanView {
  readonly plan: CollectionPlan;
  readonly pricing: PricingByStyle;
  readonly source: RatesSource;
  /** The brand's products, so a style card can be pointed at one. */
  readonly products: readonly ProductView[];
}

/** One plan with everything the board, the line plan and the two actions need, or null when it is gone. */
export async function loadPlanView(client: SupabaseClient, brandId: string, collectionId: string): Promise<PlanView | null> {
  const plan = await loadPlan(client, brandId, collectionId);
  if (plan === null) return null;
  const [snapshot, source, products] = await Promise.all([snapshotOfFactory(), ratesSourceOf(client, plan), listProducts(client, brandId)]);
  return { plan, pricing: pricingFor(plan.styles, snapshot, source), source, products };
}

/** The plans of the brand for the index page. */
export const loadCollections = (client: SupabaseClient, brandId: string): Promise<readonly CollectionSummary[]> => listCollections(client, brandId);

export interface Market {
  readonly country: string;
  readonly name: string;
  readonly currency: string;
}

/** The markets a plan may be landed in: the country rules that are open for selling (spec decision 3). */
export async function loadMarkets(): Promise<readonly Market[]> {
  const rules = await factoryStore().listCountryRules();
  return rules
    .filter((rule) => rule.sellingEnabled)
    .map((rule) => ({ country: rule.country, name: rule.name, currency: rule.currency }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface StyleRender {
  readonly src: string;
  /** Said under the picture: it is a render, never a photo of a garment. */
  readonly label: string;
}

/**
 * The render on a style card: the newest illustration of the design behind it, as the studio home and
 * the make page read it. A style with no design, or a design with no render yet, has none, and the card
 * draws an outline instead.
 */
export async function loadStyleRender(client: SupabaseClient, brandId: string, projectId: string | null): Promise<StyleRender | null> {
  if (projectId === null) return null;
  const latest = await latestImages(client, brandId, projectId).catch(() => null);
  const loaded = latest ? await loadIllustrations(createFileReader(client, brandId), latest) : null;
  const first = loaded?.illustrations[0];
  return first ? { src: first.src, label: "A render, not a photo of a garment" } : null;
}
