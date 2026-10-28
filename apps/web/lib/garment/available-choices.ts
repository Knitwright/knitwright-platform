import { checkCombination } from "./combinations";
import { plainChoices } from "./conditions";
import { getType } from "./registry";
import type { SpecShape } from "./applicability";

interface AvailableChoice {
  readonly choiceId: string;
  readonly label: string;
  readonly help: string | undefined;
  /** False when choosing it would break a rule, given the other current choices. */
  readonly available: boolean;
  /** Why it is not available, in plain words, or null when it is. */
  readonly reason: string | null;
}

/**
 * Every choice the type offers for an option, each marked available or not. The editor
 * uses this to grey a choice out and say why. Only rules that involve this option count,
 * so an unrelated clash elsewhere does not lock the option.
 */
export function availableChoices(spec: SpecShape, optionId: string): readonly AvailableChoice[] {
  const option = getType(spec.typeId)?.options.find((entry) => entry.id === optionId);
  if (!option) return [];
  const current = plainChoices(spec.options);
  return option.choices.map((choice) => {
    const clashes = checkCombination(spec.typeId, { ...current, [optionId]: choice.id }).filter((violation) =>
      violation.options.includes(optionId),
    );
    return {
      choiceId: choice.id,
      label: choice.label,
      help: choice.help,
      available: clashes.length === 0,
      reason: clashes.length === 0 ? null : clashes.map((violation) => violation.reason).join(" "),
    };
  });
}
