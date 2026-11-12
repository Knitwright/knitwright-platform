import { priceFor, type Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import { baseUnitMinor } from "@/lib/teamwear/pricing";
import { money } from "./format";

/**
 * The order summary on the order page (screen 33): production, the team discount, shipping,
 * sampling and the total.
 *
 * Nothing here charges anything. The platform has no payment yet (C1 brings checkout), so:
 *   * production and the discount are worked out from the factory's price tiers (decision 0071) and
 *     say so: production is every piece at the smallest tier's price, the discount is what the
 *     order's tier saves on that;
 *   * shipping and a sampling fee are not on file anywhere, and the summary says so rather than
 *     printing £0.00;
 *   * the total is the Store's own figure when the order came with one, and is otherwise "not set".
 */

export interface SummaryLine {
  readonly label: string;
  readonly value: string;
  /** A saving, shown as a credit. */
  readonly credit?: boolean;
}

export interface OrderSummary {
  readonly lines: readonly SummaryLine[];
  readonly total: string | null;
  readonly note: string;
}

export interface SummaryInput {
  readonly kind: "sample" | "run" | "order";
  readonly pieces: number;
  readonly currency: SellCurrency;
  readonly ladder: Ladder;
  /** The Store's price for the order, when it gave one. */
  readonly value: Readonly<{ minor: number; currency: string }> | null;
}

export const NOT_ON_FILE = "Not on file";
const NO_TOTAL = "No total yet: shipping is not on file, and payments arrive with checkout. Prices are from the factory tiers and are placeholders.";
const STORE_TOTAL = "The total is the price the order arrived with.";

function productionLines(input: SummaryInput): readonly SummaryLine[] {
  const price = priceFor(input.ladder, input.pieces, input.currency);
  const base = baseUnitMinor(input.ladder, input.currency);
  if (price.status !== "priced" || base === null) {
    return [{ label: "Production", value: price.status === "priced" ? NOT_ON_FILE : price.reason }];
  }
  const lines: SummaryLine[] = [{ label: `Production (${input.pieces} × ${money(base, input.currency)})`, value: money(base * input.pieces, input.currency) }];
  const saving = (base - price.unitMinor) * input.pieces;
  if (saving > 0) lines.push({ label: `Team discount (${price.tier.qtyMin}+ pieces)`, value: `−${money(saving, input.currency)}`, credit: true });
  return lines;
}

export function orderSummary(input: SummaryInput): OrderSummary {
  const lines: SummaryLine[] = [
    ...productionLines(input),
    { label: "Shipping", value: NOT_ON_FILE },
    { label: "Sampling", value: input.kind === "sample" ? NOT_ON_FILE : "None" },
  ];
  if (input.value === null) return { lines, total: null, note: NO_TOTAL };
  return { lines, total: money(input.value.minor, input.value.currency), note: STORE_TOTAL };
}
