import { formatMoney, priceBasket, type Ladder, type PriceResult } from "@/lib/factory/pricing";
import type { PriceTier, SellCurrency } from "@/lib/factory/schemas";
import type { PriceSource } from "@/lib/home/price";
import { kitParts, totalPieces, type KitPart, type TeamwearKit } from "./kit";
import { GAP_RULE_ID, RULES } from "./vocabulary";

/**
 * The sticky footer (spec F-T1): the quantity stepper, the price for each piece with the tier's
 * discount badge, and the kit total. Every number comes from X6's price tiers (decision 0071)
 * through `priceBasket`, so a quote and this footer agree to the penny, and the tier is read at
 * every piece in the kit, as spec F-T5 requires.
 *
 * Nothing here makes a price up. A part with no base article, an article the factory has no
 * capability for, and a tier with no price in the chosen currency each say so in words.
 */

/** The ladders the footer was given, by article code. */
export type PriceBookFor = (articleCode: string) => PriceSource;

/** The smallest number of pieces the stepper allows for a part: the factory's own minimum, else one. */
export const quantityFloor = (source: PriceSource | null): number => (source?.moq ?? 1) || 1;

/**
 * The largest number the stepper goes to. It is a limit on the control, not a factory limit: the
 * top tier is open-ended and no row says what one order may hold. **Owner question** on the pull
 * request: what is the largest order the configurator should take without a conversation?
 */
export const QUANTITY_MAX = 10_000;

/** A quantity the stepper may hold: a whole number inside the part's own floor and the screen's limit. */
export function clampQuantity(wanted: number, floor: number): number {
  if (!Number.isFinite(wanted)) return floor;
  return Math.min(QUANTITY_MAX, Math.max(floor, Math.round(wanted)));
}

const sellOf = (tier: PriceTier, currency: SellCurrency): number | null =>
  currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor;

/**
 * The unit price of the smallest tier that carries one, which is what a discount is measured
 * against: the badge says how much cheaper this order is than the smallest one the factory prices.
 */
export function baseUnitMinor(ladder: Ladder, currency: SellCurrency): number | null {
  const priced = ladder.filter((tier) => sellOf(tier, currency) !== null);
  if (priced.length === 0) return null;
  const smallest = priced.reduce((best, tier) => (tier.qtyMin < best.qtyMin ? tier : best));
  return sellOf(smallest, currency);
}

/** "−24%", or null when this tier is the smallest one or no base price exists to measure against. */
export function discountBadge(ladder: Ladder, currency: SellCurrency, unitMinor: number): string | null {
  const base = baseUnitMinor(ladder, currency);
  if (base === null || base <= 0 || unitMinor >= base) return null;
  const percent = Math.round(((base - unitMinor) / base) * 100);
  return percent > 0 ? `−${percent}%` : null;
}

export interface PartPrice {
  readonly partId: string;
  readonly label: string;
  readonly articleCode: string | null;
  readonly quantity: number;
  /** The smallest the stepper goes for this part. */
  readonly floor: number;
  /** "£25.00", or the reason there is no price. */
  readonly unit: string;
  /** "£500.00", or the reason there is no price. */
  readonly line: string;
  /** The line in integer minor units, or null when there is no price. Money is never read back out of the words. */
  readonly lineMinor: number | null;
  readonly priced: boolean;
  readonly discount: string | null;
  /** The stored label of the tier the price came from, so no screen can show it as a factory quote. */
  readonly tierLabel: string | null;
  readonly ruleId: string;
  /** Why this part has no price, or null when it has one. */
  readonly reason: string | null;
}

export interface KitPrice {
  readonly currency: SellCurrency;
  /**
   * The quantity the tier was read at: every piece the factory prices. A part the factory has no
   * price for is not being ordered, so it does not move anyone's tier.
   */
  readonly tierQty: number;
  /** Every piece in the kit, priced or not, which is what the footer's stepper totals add up to. */
  readonly pieces: number;
  readonly parts: readonly PartPrice[];
  readonly totalMinor: number | null;
  /** "£740.00", or the reason the kit has no total. It totals the parts that are priced, never the kit as a whole. */
  readonly total: string;
  readonly priced: boolean;
  /** False while any part of the kit has no price, so the footer can say the total leaves that part out. */
  readonly everyPartPriced: boolean;
  /** One sentence naming the parts the total leaves out, or null when it leaves none out. */
  readonly totalNote: string | null;
  /** The factory the prices came from, or null when none could be read. */
  readonly factoryName: string | null;
}

/** Said in the footer where no price could be read at all. */
export const NO_PRICE = "Not priced yet";

/** Said beside the price, from the rulebook: the whole panel is printed either way (R-COST-001). */
export const PATTERN_COST_NOTE = "A busy design costs the same as a plain one: the whole panel is printed either way.";
export const PATTERN_COST_RULE = RULES.patternCost;

/** Said where names and numbers are on. Their per-piece price is a placeholder until a factory confirms it (R-COST-003). */
export const NAMES_COST_NOTE = "Names and numbers are printed in the same pass. Their per-piece price is a placeholder until the factory confirms it.";
export const NAMES_COST_RULE = RULES.personalisationCost;

const reasonOf = (price: PriceResult): string | null => (price.status === "priced" ? null : price.reason);

const priceOf = (
  part: KitPart & Readonly<{ quantity: number }>,
  source: PriceSource | null,
  price: PriceResult | null,
  currency: SellCurrency,
): PartPrice => {
  const floor = quantityFloor(source);
  if (price === null || price.status !== "priced") {
    return {
      partId: part.id,
      label: part.label,
      articleCode: part.articleCode,
      quantity: part.quantity,
      floor,
      unit: NO_PRICE,
      line: NO_PRICE,
      lineMinor: null,
      priced: false,
      discount: null,
      tierLabel: null,
      ruleId: GAP_RULE_ID,
      reason: price === null ? "This part has no base article in the catalogue, so the factory has no price for it." : reasonOf(price),
    };
  }
  return {
    partId: part.id,
    label: part.label,
    articleCode: part.articleCode,
    quantity: part.quantity,
    floor,
    unit: formatMoney(price.unitMinor, currency),
    line: formatMoney(price.lineMinor, currency),
    lineMinor: price.lineMinor,
    priced: true,
    discount: discountBadge(source?.ladder ?? [], currency, price.unitMinor),
    tierLabel: price.label,
    ruleId: GAP_RULE_ID,
    reason: null,
  };
};

/**
 * The whole kit's price. Parts with a base article are priced together, so the tier is read at the
 * basket; a part without one is listed with the reason it has no price and is left out of the total.
 * The total is null unless every priced part has a price, because a part-total would read as the
 * price of the kit.
 */
export function kitPrice(
  kit: TeamwearKit,
  book: PriceBookFor,
  currency: SellCurrency,
  factoryName: string | null = null,
): KitPrice {
  const parts = kitParts(kit).map((part) => ({ ...part, quantity: part.choice.quantity }));
  const withArticle = parts.filter((part) => part.articleCode !== null);
  const sources = new Map(withArticle.map((part) => [part.id, book(part.articleCode!)] as const));
  const basket = priceBasket(
    withArticle.map((part) => ({ articleCode: part.articleCode!, qty: part.quantity, ladder: sources.get(part.id)!.ladder })),
    currency,
  );
  const priced = parts.map((part) => {
    const at = withArticle.indexOf(part);
    return priceOf(part, sources.get(part.id) ?? null, at === -1 ? null : basket.lines[at]?.price ?? null, currency);
  });
  const totalMinor = basket.totalMinor;
  const missing = priced.filter((part) => !part.priced).map((part) => part.label);
  return {
    currency,
    tierQty: basket.tierQty,
    pieces: totalPieces(kit),
    parts: priced,
    totalMinor,
    total: totalMinor === null ? NO_PRICE : formatMoney(totalMinor, currency),
    priced: totalMinor !== null,
    everyPartPriced: missing.length === 0,
    totalNote: missing.length === 0 ? null : `The total leaves out ${missing.join(" and ")}, which ${missing.length === 1 ? "has" : "have"} no price yet.`,
    factoryName,
  };
}
