import type { Finding } from "@/lib/production/contract";
import { readinessFindings } from "./checks/readiness";
import { profileFindings } from "./checks/profile";
import { sortFindings } from "./hash";
import type { FactoryProfile } from "./profile";
import { createCheckRegistry, type CheckRegistry, type DesignInput } from "./registry";

export interface ValidationResult {
  readonly findings: readonly Finding[];
  readonly blockers: number;
  readonly warnings: number;
  /** True when there is no blocker. It says nothing about warnings. */
  readonly orderable: boolean;
}

/**
 * Decides whether a design can go to the factory in `profile`. Runs the built-in checks and every
 * module in `registry`. A module that throws becomes a blocker rather than hiding the others.
 */
export function validateDesign(design: DesignInput, profile: FactoryProfile, registry: CheckRegistry = createCheckRegistry()): ValidationResult {
  const fromModules = registry.modules.flatMap((module) => {
    try {
      return module.run(design, profile);
    } catch {
      return [
        {
          code: "check-failed",
          severity: "blocker" as const,
          article: design.typeId,
          panel: null,
          message: `The "${module.id}" check could not run.`,
          fix: { action: "Try again. If it keeps failing, tell Knitwright.", whoActs: "owner" as const },
        },
      ];
    }
  });
  const findings = sortFindings([...profileFindings(design, profile), ...readinessFindings(design), ...fromModules]);
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  return { findings, blockers, warnings: findings.length - blockers, orderable: blockers === 0 };
}
