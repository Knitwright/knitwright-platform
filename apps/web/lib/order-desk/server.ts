import "server-only";
import type { Ladder } from "@/lib/factory/pricing";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import type { FactorySnapshot, SellCurrency } from "@/lib/factory/schemas";
import { factoryStore } from "@/lib/factory/server";
import { capabilityFor } from "@/lib/factory/service";
import { adminClient } from "@/lib/server/deps";
import { tierDiscounts, type TierDiscount } from "./discounts";

/**
 * Joins the Orders area to the factory rows (decision 0071): the one factory on file, its tiers, the
 * days for QC and the market's freight days. It holds no rules of its own; `discounts.ts`,
 * `delivery.ts` and `summary.ts` have those and are tested.
 */

const COUNTRY_OF: Readonly<Record<SellCurrency, string>> = { GBP: "GB", AUD: "AU" };

export interface FactoryFacts {
  readonly snapshot: FactorySnapshot | null;
  readonly qcDays: number | null;
  readonly freightDays: number | null;
  readonly discounts: readonly TierDiscount[];
}

const laddersOf = (snapshot: FactorySnapshot | null): readonly Ladder[] =>
  snapshot === null ? [] : snapshot.capabilities.map((capability) => snapshot.tiers.filter((tier) => tier.capabilityId === capability.id));

export async function loadFactoryFacts(currency: SellCurrency): Promise<FactoryFacts> {
  const store = factoryStore();
  const [factories, rules, settings] = await Promise.all([store.listFactories(), store.listCountryRules(), loadProductionSettings(adminClient())]);
  const factory = [...factories].sort((a, b) => a.slug.localeCompare(b.slug))[0] ?? null;
  const snapshot = factory ? await store.snapshot(factory) : null;
  const rule = rules.find((one) => one.country === COUNTRY_OF[currency] && one.sellingEnabled) ?? null;
  return { snapshot, qcDays: settings.qcDays, freightDays: rule?.freightDays ?? null, discounts: tierDiscounts(laddersOf(snapshot), currency) };
}

/** The tiers for an order's article, or none when the article is not one the factory prices. */
export function ladderForArticle(snapshot: FactorySnapshot | null, articleId: string): Ladder {
  if (snapshot === null) return [];
  const capability = capabilityFor(snapshot, articleId);
  return capability ? snapshot.tiers.filter((tier) => tier.capabilityId === capability.id) : [];
}
