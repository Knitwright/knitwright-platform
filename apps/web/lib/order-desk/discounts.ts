import type { Ladder } from "@/lib/factory/pricing";
import type { PriceTier, SellCurrency } from "@/lib/factory/schemas";
import { baseUnitMinor } from "@/lib/teamwear/pricing";

/**
 * The team and bulk discount banner (08 v3.5): "10% · 20+ pieces". Every figure comes from the
 * factory's price tiers (decision 0071); none is typed here. A tier's saving is measured against the
 * smallest tier of its own ladder, as the configurator's badge is. Where articles save different
 * amounts at the same quantity the banner shows the smallest, so it never promises more than every
 * article gives.
 */

export interface TierDiscount {
  readonly minQty: number;
  readonly percent: number;
}

const sellOf = (tier: PriceTier, currency: SellCurrency): number | null => (currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor);

function savingsOf(ladder: Ladder, currency: SellCurrency): readonly TierDiscount[] {
  const base = baseUnitMinor(ladder, currency);
  if (base === null || base <= 0) return [];
  return ladder.flatMap((tier) => {
    const unit = sellOf(tier, currency);
    return unit === null ? [] : [{ minQty: tier.qtyMin, percent: Math.round(((base - unit) / base) * 100) }];
  });
}

export function tierDiscounts(ladders: readonly Ladder[], currency: SellCurrency): readonly TierDiscount[] {
  const smallest = new Map<number, number>();
  for (const saving of ladders.flatMap((ladder) => savingsOf(ladder, currency))) {
    const seen = smallest.get(saving.minQty);
    smallest.set(saving.minQty, seen === undefined ? saving.percent : Math.min(seen, saving.percent));
  }
  return [...smallest.entries()]
    .filter(([, percent]) => percent > 0)
    .map(([minQty, percent]) => ({ minQty, percent }))
    .sort((a, b) => a.minQty - b.minQty);
}
