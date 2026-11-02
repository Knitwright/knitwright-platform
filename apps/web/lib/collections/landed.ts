import { priceFor, type Ladder, type PriceResult } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import type { LandedRates } from "./types";

/**
 * What one piece costs landed at the destination (spec F-S10, "Unit cost"): the Knitwright price tier
 * for the quantity, plus freight and duty to the destination.
 *
 * The tier part is `priceFor` and nothing else, so a plan's tier cost equals the price of the same
 * basket to the penny (decision 0071, and the test in line-plan.test.ts). Freight and duty are added
 * on top from rows, each of which may be missing; a missing figure is never a zero that hides itself,
 * it is a note saying what is not on file.
 *
 * Rounding happens once, per piece, as it does in `priceFor`: a unit price times a quantity is then
 * exact in minor units, and the line and the footer cannot disagree.
 */

export type LandedCost =
  | Readonly<{
      status: "landed";
      qty: number;
      /** The tier price of one piece: `priceFor`, untouched. */
      tierUnitMinor: number;
      freightUnitMinor: number;
      dutyUnitMinor: number;
      /** tier + freight + duty, per piece. */
      unitMinor: number;
      /** The tier part of the line, which is exactly `priceFor(...).lineMinor`. */
      tierLineMinor: number;
      /** unitMinor times the quantity. */
      lineMinor: number;
      currency: SellCurrency;
      tierLabel: string;
      labels: readonly string[];
      ruleIds: readonly string[];
      /** What is not on file, in words. Empty when freight and duty both came from a row. */
      notes: readonly string[];
    }>
  | Readonly<{ status: "no-price"; qty: number; reason: string }>;

export interface LandedInput {
  readonly ladder: Ladder;
  readonly qty: number;
  /** The quantity the tier is read at: every piece in the plan (spec F-T5). Defaults to `qty`. */
  readonly tierQty?: number;
  readonly currency: SellCurrency;
  readonly rates: LandedRates;
}

const NO_LADDER = "No price is on file for this style's article yet.";

/** Duty on a value in minor units, at a rate in basis points, rounded to the penny once. */
export const dutyOn = (valueMinor: number, rateBp: number): number => Math.round((valueMinor * rateBp) / 10_000);

/** The freight a piece carries, with the reason when none is added. */
const freightOf = (rates: LandedRates, currency: SellCurrency): Readonly<{ minor: number; note: string | null }> => {
  if (rates.freightPerPieceMinor === null) {
    return { minor: 0, note: `No freight rate is on file for ${rates.country}, so freight is not in this cost.` };
  }
  if (rates.freightCurrency !== currency) {
    return {
      minor: 0,
      note: `The freight rate for ${rates.country} is in ${rates.freightCurrency}, not ${currency}, so freight is not in this cost.`,
    };
  }
  return { minor: rates.freightPerPieceMinor, note: null };
};

/** The duty a piece carries, on the basis the freight row names, with the reason when none is added. */
const dutyOf = (rates: LandedRates, tierUnitMinor: number, freightUnitMinor: number): Readonly<{ minor: number; note: string | null }> => {
  if (rates.hsCode === null) {
    return { minor: 0, note: "This style's article has no HS code on file, so duty is not in this cost." };
  }
  if (rates.dutyRateBp === null) {
    return { minor: 0, note: `No duty rate is on file for ${rates.hsCode} into ${rates.country}, so duty is not in this cost.` };
  }
  const base = rates.dutyBasis === "goods_and_freight" ? tierUnitMinor + freightUnitMinor : tierUnitMinor;
  return { minor: dutyOn(base, rates.dutyRateBp), note: null };
};

/** The landed cost of `qty` pieces of one style, or why there is no price. */
export function landedCost(input: LandedInput): LandedCost {
  const { ladder, qty, currency, rates } = input;
  if (qty < 1) return { status: "no-price", qty, reason: "This style has no pieces planned yet." };
  const price: PriceResult = ladder.length === 0 ? { status: "not-made", reason: NO_LADDER } : priceFor(ladder, qty, currency, input.tierQty ?? qty);
  if (price.status !== "priced") return { status: "no-price", qty, reason: price.status === "not-made" ? NO_LADDER : price.reason };

  const freight = freightOf(rates, currency);
  const duty = dutyOf(rates, price.unitMinor, freight.minor);
  const unitMinor = price.unitMinor + freight.minor + duty.minor;
  return {
    status: "landed",
    qty,
    tierUnitMinor: price.unitMinor,
    freightUnitMinor: freight.minor,
    dutyUnitMinor: duty.minor,
    unitMinor,
    tierLineMinor: price.lineMinor,
    lineMinor: unitMinor * qty,
    currency: price.currency,
    tierLabel: price.label,
    labels: [price.label, ...rates.labels],
    ruleIds: [...new Set([...rates.ruleIds])],
    notes: [freight.note, duty.note].filter((note): note is string => note !== null),
  };
}

/** The landed line total, or null where the style has no price. */
export const landedLineOf = (cost: LandedCost): number | null => (cost.status === "landed" ? cost.lineMinor : null);

/** The tier part of the line, or null where the style has no price. */
export const tierLineOf = (cost: LandedCost): number | null => (cost.status === "landed" ? cost.tierLineMinor : null);

/** Rates with nothing on file: used where no freight row and no HS code exist for a destination. */
export const noRates = (country: string): LandedRates => ({
  country,
  freightPerPieceMinor: null,
  freightCurrency: null,
  dutyBasis: "goods_and_freight",
  dutyRateBp: null,
  hsCode: null,
  labels: [],
  ruleIds: [],
});
