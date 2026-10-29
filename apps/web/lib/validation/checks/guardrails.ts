import { bleedCheck, gamutCheck, minDpiCheck, safeZoneCheck, seamCrossCheck, type Finding as GuardrailFinding, type GuardrailInput } from "@/lib/guardrails";
import { finding } from "../finding";
import type { CheckModule, DesignInput, RuledFinding } from "../registry";
import { ruleIdFor } from "../rules";

/** A guardrail finding in the validation gate's shape. The guardrails speak to the person designing, so the owner acts. */
const fromGuardrail = (design: DesignInput, found: GuardrailFinding): RuledFinding => ({
  ...finding({ code: found.code, severity: found.severity, article: design.typeId, panel: found.panel, message: found.message, action: found.fix, whoActs: "owner" }),
  ruleId: ruleIdFor(found.code),
});

type Run = (input: GuardrailInput) => readonly GuardrailFinding[];

const perPanel = (fn: (panel: GuardrailInput["panels"][number], input: GuardrailInput) => GuardrailFinding[]): Run => (input) =>
  input.panels.flatMap((panel) => fn(panel, input));

const guardrailModule = (id: string, code: string, run: Run): CheckModule => ({
  id,
  ruleId: ruleIdFor(code),
  run: (design) => (design.guardrails === undefined ? [] : run(design.guardrails).map((found) => fromGuardrail(design, found))),
});

/** The five editor guardrails (decision 0045) as validation check modules. Each runs on the design's guardrail input. */
export const GUARDRAIL_CHECKS: readonly CheckModule[] = [
  guardrailModule("seam-crossing", "seam-cross", perPanel((panel, i) => seamCrossCheck(panel, i.items))),
  guardrailModule("dpi", "min-dpi", (i) => minDpiCheck(i.items, i.settings)),
  guardrailModule("bleed", "bleed-short", perPanel((panel, i) => bleedCheck(panel, i.items, i.settings))),
  guardrailModule("safe-zone", "safe-zone", perPanel((panel, i) => safeZoneCheck(panel, i.items, i.settings))),
  guardrailModule("gamut", "gamut-approx", (i) => gamutCheck(i.colours)),
];
