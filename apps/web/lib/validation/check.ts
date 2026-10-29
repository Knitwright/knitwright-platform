import { z } from "zod";
import type { Finding } from "@/lib/production/contract";
import type { RuledFinding } from "./registry";
import { RULE_ID_PATTERN, ruleIdFor } from "./rules";

/**
 * One check as `validation_results.checks` stores it (spec 03-data-model `validation_result`): its code, severity,
 * message, target, rule id and whether it passed. A passing check has no severity.
 */
export const validationCheckSchema = z
  .object({
    code: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
    severity: z.enum(["blocker", "warning"]).nullable(),
    message: z.string().min(1).max(600),
    target: z.object({ article: z.string().max(64).nullable(), panel: z.string().max(64).nullable() }).readonly(),
    ruleId: z.string().regex(RULE_ID_PATTERN),
    passed: z.boolean(),
  })
  .readonly();
export type ValidationCheck = z.output<typeof validationCheckSchema>;

/** A finding as a failed check. The rule is the finding's own, or the rule of its code. */
export const checkOf = (found: Finding): ValidationCheck => ({
  code: found.code,
  severity: found.severity,
  message: found.message,
  target: { article: found.article, panel: found.panel },
  ruleId: (found as RuledFinding).ruleId ?? ruleIdFor(found.code),
  passed: false,
});

/** A module that ran and found nothing. */
export const passedCheck = (moduleId: string, ruleId: string): ValidationCheck => ({
  code: moduleId,
  severity: null,
  message: "Nothing found.",
  target: { article: null, panel: null },
  ruleId,
  passed: true,
});

/** No blocker among the checks. */
export const checksPass = (checks: readonly ValidationCheck[]): boolean => checks.every((c) => c.passed || c.severity !== "blocker");
