import type { Condition } from "./definitions";

/**
 * Chosen options as callers hold them. A plain map of option id to choice id works,
 * and so does the stored form of a spec, where each choice also carries provenance.
 */
export type ChoiceMap = Readonly<Record<string, string | { readonly choiceId: string }>>;

/** The choice id chosen for an option, or undefined when the option is not chosen. */
function choiceOf(options: ChoiceMap, optionId: string): string | undefined {
  if (!Object.hasOwn(options, optionId)) return undefined;
  const chosen = options[optionId];
  return typeof chosen === "string" ? chosen : chosen?.choiceId;
}

/** A plain map of option id to choice id, whatever form the options came in. */
export function plainChoices(options: ChoiceMap): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.keys(options).flatMap((id) => {
      const choice = choiceOf(options, id);
      return choice === undefined ? [] : [[id, choice]];
    }),
  );
}

/**
 * True when every condition holds. An option that is not chosen never satisfies a
 * condition, so a garment without a placket option has no placket.
 */
export function conditionsHold(conditions: readonly Condition[], options: ChoiceMap): boolean {
  return conditions.every((condition) => {
    const chosen = choiceOf(options, condition.option);
    return chosen !== undefined && condition.in.includes(chosen);
  });
}
