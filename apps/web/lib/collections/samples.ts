import { SAMPLE_MAX_SIZES, SAMPLE_PIECES_PER_SIZE } from "@/lib/make/vocabulary";
import { unitsOf } from "./board";
import type { CollectionPlan, Style } from "./types";
import { blocker, pieces, warning, type Finding } from "./vocabulary";

/**
 * "Order samples for all approved styles" (spec F-S10). The order itself goes through the make flow's
 * one door (plan v5 Y7): a sample is one piece per size, at most three sizes, against a product the
 * brand has listed, and `submit_make_order` checks all of that again in the database.
 *
 * This file only decides which styles go and with which sizes. A style the plan cannot sample is never
 * silently dropped: it comes back with the reason and the rule behind it.
 */

export interface SampleTarget {
  readonly styleId: string;
  readonly name: string;
  readonly productId: string;
  /** The sizes to ask for, one piece each. At most `SAMPLE_MAX_SIZES`. */
  readonly sizes: readonly string[];
  readonly pieces: number;
}

export interface SkippedStyle {
  readonly styleId: string;
  readonly name: string;
  readonly finding: Finding;
}

export interface SamplePlan {
  readonly targets: readonly SampleTarget[];
  readonly skipped: readonly SkippedStyle[];
  /** Said under the button: what would be ordered. */
  readonly summary: string;
  readonly canOrder: boolean;
}

/** The sizes a sample asks for: the planned sizes that carry pieces, up to the sample's limit. */
export const sampleSizesOf = (style: Style): readonly string[] =>
  style.sizes
    .filter((size) => size.qty > 0)
    .map((size) => size.label)
    .slice(0, SAMPLE_MAX_SIZES);

/** Why this approved style cannot be sampled, or null when it can. */
const whyNot = (style: Style): Finding | null => {
  if (style.productId === null) {
    return blocker("sample_no_product", `${style.name} is not listed as a product yet. A sample is ordered against a product.`);
  }
  if (unitsOf(style) === 0) return blocker("sample_no_sizes", `${style.name} has no sizes planned, so there is nothing to sample.`);
  return null;
};

/** Every approved style of the plan, with the sizes its sample would ask for. */
export function samplesForApproved(plan: CollectionPlan): SamplePlan {
  const approved = plan.styles.filter((style) => style.status === "approved");
  const targets: SampleTarget[] = [];
  const skipped: SkippedStyle[] = [];
  for (const style of approved) {
    const reason = whyNot(style);
    if (reason !== null || style.productId === null) {
      skipped.push({ styleId: style.id, name: style.name, finding: reason ?? blocker("sample_no_product", `${style.name} is not listed as a product yet.`) });
      continue;
    }
    const sizes = sampleSizesOf(style);
    targets.push({ styleId: style.id, name: style.name, productId: style.productId, sizes, pieces: sizes.length * SAMPLE_PIECES_PER_SIZE });
  }
  return { targets, skipped, summary: summaryOf(approved.length, targets), canOrder: targets.length > 0 };
}

const summaryOf = (approved: number, targets: readonly SampleTarget[]): string => {
  if (approved === 0) return "No style in this plan is approved yet.";
  if (targets.length === 0) return "No approved style can be sampled yet.";
  const total = targets.reduce((sum, target) => sum + target.pieces, 0);
  return `${targets.length} of ${approved} approved ${approved === 1 ? "style" : "styles"} · one piece per size · ${pieces(total)}.`;
};

/** What is worth saying beside the button, including the sizes a sample cannot cover. */
export function sampleFindings(plan: CollectionPlan): readonly Finding[] {
  const over = plan.styles.filter((style) => style.status === "approved" && style.sizes.filter((size) => size.qty > 0).length > SAMPLE_MAX_SIZES);
  return [
    ...samplesForApproved(plan).skipped.map((one) => one.finding),
    over.length > 0
      ? warning(
          "sample_sizes_trimmed",
          `A sample is at most ${SAMPLE_MAX_SIZES} sizes, so ${over.length === 1 ? "one style asks" : `${over.length} styles ask`} for its first ${SAMPLE_MAX_SIZES} planned sizes only.`,
        )
      : null,
  ].filter((found): found is Finding => found !== null);
}
