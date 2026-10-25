import type { RunKind } from "./breakdown";

export const STAGES = ["idea", "sample", "run"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Readonly<Record<Stage, string>> = { idea: "Idea", sample: "Sample", run: "Run" };

export const isStage = (value: unknown): value is Stage => STAGES.some((stage) => stage === value);

/** The stage a brand may confirm next, or null at the end. A product only moves forward, one step. */
export const nextStage = (stage: Stage): Stage | null => STAGES[STAGES.indexOf(stage) + 1] ?? null;

/**
 * Moving to "sample" needs a sample order already sent; moving to "run" is the brand's own confirmation of the sample.
 * The database makes the same rule (confirm_brand_product_stage).
 */
export function canConfirm(stage: Stage, hasSampleOrder: boolean): boolean {
  const next = nextStage(stage);
  if (next === null) return false;
  return next === "sample" ? hasSampleOrder : true;
}

/** A sample is ordered before the run; a run only once the product is at "run". */
export function canOrder(stage: Stage, kind: RunKind): boolean {
  return kind === "sample" ? stage !== "run" : stage === "run";
}

export function whyNotOrder(stage: Stage, kind: RunKind): string | null {
  if (canOrder(stage, kind)) return null;
  return kind === "sample" ? "This product is already at the run stage." : "Order and confirm a sample first. A run starts once the product is at the run stage.";
}
