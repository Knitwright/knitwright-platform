import type { SimulationState, ValidateChip } from "@/lib/editor";

/**
 * "FIT CHECKED" (plan v6 G1, decision 0150; `08` v3.6: Fabra's "Not sim ready", top right of the stage).
 *
 * The chip reads two things the editor already knows and invents neither: what the last save's
 * checks found (`validateChip`, X4) and whether the 3D model still matches the form (`simulateChip`).
 * It says "Fit checked" only when both are true -- the checks ran and block nothing, and the model was
 * built from the form on screen. Anything else says which of the two is missing.
 */

export type FitTone = "ok" | "warn" | "bad" | "neutral";

export interface FitChip {
  readonly label: string;
  readonly tone: FitTone;
  /** What a screen reader hears: both halves, in words. */
  readonly description: string;
  /** The same chip, in the shape the findings list (`ValidateChip`) takes. */
  readonly chip: ValidateChip;
}

const SIM_WORDS: Readonly<Record<SimulationState, string>> = {
  ready: "The 3D model matches the design.",
  stale: "The 3D model was built before the last change: press Simulate to build it again.",
  none: "There is no 3D model of this base yet.",
};

export function fitChip(checks: ValidateChip, simulation: SimulationState): FitChip {
  const description = `${checks.description} ${SIM_WORDS[simulation]}`;
  const make = (label: string, tone: FitTone): FitChip => ({ label, tone, description, chip: { ...checks, label, description } });
  if (checks.tone === "blocked") return make(checks.label, "bad");
  if (checks.tone === "unchecked") return make(checks.label, "neutral");
  if (simulation !== "ready") return make("Not sim ready", "warn");
  return make("Fit checked", "ok");
}
