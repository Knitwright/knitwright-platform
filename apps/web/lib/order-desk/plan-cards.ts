import type { LineRow } from "@/lib/collections/line-plan";
import type { Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import { money } from "./format";

/**
 * The attribute table on a range plan style card (09 screen 32, 08 v3.7): fabric, MOQ and target
 * cost, beside the sizes and status the card already shows. MOQ is the smallest quantity the factory
 * prices this article at in the plan's currency; the target cost is the line plan's landed unit cost
 * (tier, freight and duty) at the whole plan's quantity. Where either is not on file the card says so.
 */

export interface StyleFacts {
  readonly fabric: string;
  readonly moq: string;
  readonly targetCost: string;
}

export const NOT_SET = "Not set";

export function moqOf(ladder: Ladder, currency: SellCurrency): number | null {
  const priced = ladder.filter((tier) => (currency === "GBP" ? tier.sellGbpMinor : tier.sellAudMinor) !== null);
  return priced.length === 0 ? null : Math.min(...priced.map((tier) => tier.qtyMin));
}

export function styleFacts(row: LineRow | undefined, ladder: Ladder, currency: SellCurrency, fabricCode: string | null): StyleFacts {
  const moq = moqOf(ladder, currency);
  return {
    fabric: fabricCode ?? NOT_SET,
    moq: moq === null ? NOT_SET : `${moq} pieces`,
    targetCost: row?.cost.status === "landed" ? money(row.cost.unitMinor, currency) : NOT_SET,
  };
}
