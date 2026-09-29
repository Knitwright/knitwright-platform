import type { GarmentSpec, SpecAction } from "@/lib/garment";

/** One answer a question offers, with the changes that answer makes. None means "leave it". */
export interface QuestionChoice {
  readonly label: string;
  readonly actions: readonly SpecAction[];
}

/**
 * What one instruction becomes. There are exactly three kinds (criterion M2): the design
 * changed and why, a question with choices, or a plain reason why nothing changed.
 */
export type IntentOutcome =
  | {
      readonly kind: "applied";
      /** The design after every change, already checked. */
      readonly spec: GarmentSpec;
      /** The changes made, in order. Applying them to the old design gives `spec`. */
      readonly actions: readonly SpecAction[];
      /** One plain sentence for each difference between the old and new design. */
      readonly explanations: readonly string[];
      /** What the change removed or reset on the way, from the registry's own messages. */
      readonly notes: readonly string[];
    }
  | {
      readonly kind: "question";
      readonly question: string;
      readonly choices: readonly QuestionChoice[];
      /** The index of the choice to show as recommended. */
      readonly recommended: number;
    }
  | { readonly kind: "rejection"; readonly reason: string };

export const OUTCOME_KINDS = ["applied", "question", "rejection"] as const satisfies readonly IntentOutcome["kind"][];

const FALLBACK_REASON = "That could not be done. Nothing was changed.";

export function rejection(reason: string): Extract<IntentOutcome, { kind: "rejection" }> {
  const said = reason.trim();
  return { kind: "rejection", reason: said === "" ? FALLBACK_REASON : said };
}

const said = (text: string): boolean => text.trim() !== "";

/**
 * True when the outcome tells the person something: a change explained, a question they
 * can answer, or a reason. The replay of the golden set asserts this on every case.
 */
export function isNeverSilent(outcome: IntentOutcome): boolean {
  switch (outcome.kind) {
    case "applied":
      return outcome.explanations.length > 0 && outcome.explanations.every(said);
    case "question":
      return (
        said(outcome.question) &&
        outcome.choices.length >= 2 &&
        outcome.choices.every((choice) => said(choice.label)) &&
        Number.isInteger(outcome.recommended) &&
        outcome.recommended >= 0 &&
        outcome.recommended < outcome.choices.length
      );
    case "rejection":
      return said(outcome.reason);
  }
}
