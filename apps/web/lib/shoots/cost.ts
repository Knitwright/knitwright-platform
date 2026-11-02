import type { LaunchCostSource } from "@/lib/launch";
import { MAX_IMAGE_COUNT, MIN_IMAGE_COUNT, SHOOT_GAP_RULE } from "./types";

/**
 * WHAT A SHOOT COSTS, SAID BEFORE ANYTHING IS SPENT (spec F-L1: "**Generate:** the button shows the
 * credit cost before running"; plan v5 L3: "credit cost on the button").
 *
 * **No number is written down here.** The credits one picture costs come from the platform's own
 * credit prices through L1's `LaunchCostSource` (`lib/launch/costs.ts`, read from the
 * `credits.price_marketing_media` setting a platform admin can change), and that source carries the
 * credits page's own notice saying the prices are placeholders the owner has not set. This file
 * multiplies by the image count and writes the words on the button.
 *
 * `CREDITS_ENFORCED` is off today, so nothing is really charged. The cost is shown anyway and the
 * panel says charging is off, because the behaviour has to be right for the day it goes on.
 */

/** How many pictures a count setting really asks for: 1 to 4, whatever was stored (F-L1). */
export const imageCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return MIN_IMAGE_COUNT;
  return Math.min(MAX_IMAGE_COUNT, Math.max(MIN_IMAGE_COUNT, Math.round(value)));
};

export interface ShootCost {
  /** Credits the whole run spends: the price of one picture times how many were asked for. */
  readonly credits: number;
  readonly perImage: number;
  readonly count: number;
  /** The words on the Generate button, with the cost in them. */
  readonly label: string;
  /** Where the figure came from. Never a sentence this file invented. */
  readonly note: string;
  readonly ruleId: string;
}

const credits = (count: number): string => `${count} ${count === 1 ? "credit" : "credits"}`;
const images = (count: number): string => `${count} ${count === 1 ? "image" : "images"}`;

/** What a run of this many pictures costs, and the button's own words for it. */
export function shootCost(count: number, source: LaunchCostSource): ShootCost {
  const wanted = imageCount(count);
  const perImage = Math.max(0, Math.round(source.perGeneratedBoard));
  const total = perImage * wanted;
  return {
    credits: total,
    perImage,
    count: wanted,
    label: `Generate ${images(wanted)} (${credits(total)})`,
    note: source.note,
    ruleId: source.ruleId,
  };
}

/** The words for one picture's price, for the line under the count control. */
export const perImageLabel = (cost: ShootCost): string => `${credits(cost.perImage)} a picture`;

/**
 * What the person is told while `CREDITS_ENFORCED` is off. It never says charging is on, and it
 * never hides the cost: the cost is what will be spent the day it is turned on.
 */
export const CHARGING_OFF_NOTE = "Credits are not being charged on this platform yet, so this run spends nothing.";

/** What a refund says on the ledger and on the screen, so the two read the same. */
export const refundReason = (count: number): string =>
  `A shoot of ${images(count)} could not keep the garment, so its credits were given back.`;

export const COST_RULE_ID = SHOOT_GAP_RULE;
