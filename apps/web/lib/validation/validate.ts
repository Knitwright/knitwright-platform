import type { Finding } from "@/lib/production/contract";
import { readinessFindings } from "./checks/readiness";
import { profileFindings } from "./checks/profile";
import { sortFindings } from "./hash";
import type { FactoryProfile } from "./profile";
import { createCheckRegistry, type CheckModule, type CheckRegistry, type DesignInput, type RuledFinding } from "./registry";
import { ruleIdFor } from "./rules";
import { checkOf, passedCheck, type ValidationCheck } from "./check";

export interface ValidationResult {
  readonly findings: readonly Finding[];
  readonly blockers: number;
  readonly warnings: number;
  /** True when there is no blocker. It says nothing about warnings. */
  readonly orderable: boolean;
  /** Every finding as a check with its rule id, plus one passing check for each module that found nothing. */
  readonly checks: readonly ValidationCheck[];
}

const failedModule = (design: DesignInput, module: CheckModule): RuledFinding => ({
  code: "check-failed",
  severity: "blocker",
  article: design.typeId,
  panel: null,
  message: `The "${module.id}" check could not run.`,
  fix: { action: "Try again. If it keeps failing, tell Knitwright.", whoActs: "owner" },
  ruleId: ruleIdFor("check-failed"),
});

const runModule = (design: DesignInput, profile: FactoryProfile, module: CheckModule): readonly RuledFinding[] => {
  try {
    return module.run(design, profile);
  } catch {
    return [failedModule(design, module)];
  }
};

/**
 * Decides whether a design can go to the factory in `profile`. Runs the built-in checks and every
 * module in `registry`. A module that throws becomes a blocker rather than hiding the others.
 */
export function validateDesign(design: DesignInput, profile: FactoryProfile, registry: CheckRegistry = createCheckRegistry()): ValidationResult {
  const perModule = registry.modules.map((module) => ({ module, found: runModule(design, profile, module) }));
  const findings = sortFindings([...profileFindings(design, profile), ...readinessFindings(design), ...perModule.flatMap((m) => m.found)]);
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  const checks = [
    ...findings.map(checkOf),
    ...perModule.filter((m) => m.found.length === 0).map((m) => passedCheck(m.module.id, m.module.ruleId ?? ruleIdFor(m.module.id))),
  ];
  return { findings, blockers, warnings: findings.length - blockers, orderable: blockers === 0, checks };
}
