import { bleedCheck } from "./bleed";
import { gamutCheck } from "./gamut";
import { minDpiCheck } from "./min-dpi";
import { safeZoneCheck } from "./safe-zone";
import { seamCrossCheck } from "./seam-cross";
import type { Finding, GuardrailInput } from "./types";

export * from "./bleed";
export * from "./gamut";
export * from "./min-dpi";
export * from "./safe-zone";
export * from "./seam-cross";
export * from "./settings";
export * from "./types";

/**
 * The planned shape of V1's `CheckModule`: an id and a pure function from the design's inputs to findings. These
 * are exported, not registered; they join V1's registry in a follow-up once V1 has merged.
 */
interface GuardrailModule {
  readonly id: "seam_cross" | "dpi" | "bleed" | "safe_zone" | "gamut";
  run(input: GuardrailInput): readonly Finding[];
}

const perPanel = (fn: (panel: GuardrailInput["panels"][number], input: GuardrailInput) => Finding[]) => (input: GuardrailInput): Finding[] =>
  input.panels.flatMap((panel) => fn(panel, input));

export const GUARDRAIL_MODULES: readonly GuardrailModule[] = [
  { id: "seam_cross", run: perPanel((panel, i) => seamCrossCheck(panel, i.items)) },
  { id: "dpi", run: (i) => minDpiCheck(i.items, i.settings) },
  { id: "bleed", run: perPanel((panel, i) => bleedCheck(panel, i.items, i.settings)) },
  { id: "safe_zone", run: perPanel((panel, i) => safeZoneCheck(panel, i.items, i.settings)) },
  { id: "gamut", run: (i) => gamutCheck(i.colours) },
];

const RANK = { blocker: 0, warning: 1 } as const;

/** Runs every check. Pure and deterministic: blockers first, then in module and panel order. */
export function runGuardrails(input: GuardrailInput): Finding[] {
  return GUARDRAIL_MODULES.flatMap((m) => m.run(input)).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
