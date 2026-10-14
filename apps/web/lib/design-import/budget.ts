import { DESIGN_IMPORT_MAX_IMAGE_EDITS, DESIGN_IMPORT_MAX_VISION_CALLS } from "@/lib/providers/catalog";

/** The most one import may spend (plan W7d, providers and cost). A count that was spent is never given back. */
export const MAX_VISION_CALLS = DESIGN_IMPORT_MAX_VISION_CALLS;
export const MAX_IMAGE_EDITS = DESIGN_IMPORT_MAX_IMAGE_EDITS;

export interface Budget {
  readonly visionCalls: number;
  readonly imageEdits: number;
}

export const FRESH_BUDGET: Budget = Object.freeze({ visionCalls: 0, imageEdits: 0 });

export const canSpend = (budget: Budget, kind: "vision" | "edit"): boolean =>
  kind === "vision" ? budget.visionCalls < MAX_VISION_CALLS : budget.imageEdits < MAX_IMAGE_EDITS;

export const spend = (budget: Budget, kind: "vision" | "edit"): Budget =>
  kind === "vision" ? { ...budget, visionCalls: budget.visionCalls + 1 } : { ...budget, imageEdits: budget.imageEdits + 1 };
