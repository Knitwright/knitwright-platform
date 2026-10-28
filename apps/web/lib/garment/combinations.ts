import { conditionsHold, type ChoiceMap } from "./conditions";
import { getType } from "./registry";

interface RuleViolation {
  readonly ruleId: string;
  /** One plain sentence saying why the combination cannot be made. */
  readonly reason: string;
  /** The ids of the options the rule involves, so a screen can point at them. */
  readonly options: readonly string[];
}

/**
 * Returns every impossible combination present in these options, each with its reason.
 * An empty list means the options fit together. It does not check that each choice is
 * offered by the type, which is the job of the spec check. An unknown type has no rules.
 */
export function checkCombination(
  typeId: string,
  options: ChoiceMap,
): readonly RuleViolation[] {
  const type = getType(typeId);
  if (!type) return [];
  return type.rules
    .filter((rule) => conditionsHold(rule.when, options))
    .map((rule) => ({
      ruleId: rule.id,
      reason: rule.reason,
      options: [...new Set(rule.when.map((condition) => condition.option))],
    }));
}
