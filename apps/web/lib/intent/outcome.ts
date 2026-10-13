import type { GarmentSpec, SpecAction } from "@/lib/garment";

/** One answer a question offers, with the changes that answer makes. None means "leave it". */
export interface QuestionChoice {
  readonly label: string;
  readonly actions: readonly SpecAction[];
}

/**
 * A one-tap way on from a part of a request that was not made. "apply" makes changes whose
 * label names them, so tapping it is the person asking for them. "say" sends its words as a
 * new message, as if typed, so any number in it is the person's own. "fill" puts its words in
 * the message box for the person to finish, such as a measurement only they can give.
 */
export type FollowUpChoice =
  | { readonly kind: "apply"; readonly label: string; readonly actions: readonly SpecAction[] }
  | { readonly kind: "say" | "fill"; readonly label: string; readonly text: string };

/** A part of the request that was not made: why, in plain words, and the ways on. */
export interface FollowUp {
  readonly text: string;
  readonly choices: readonly FollowUpChoice[];
}

/**
 * What one instruction becomes. There are exactly three kinds (criterion M2): the design
 * changed and why, a question with choices, or a plain reason why nothing changed. A change
 * or a reason may also list the parts of the request that were not made, with ways on.
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
      /** The parts of the request that were not made. Their changes apply to `spec`. */
      readonly followUps?: readonly FollowUp[];
    }
  | {
      readonly kind: "question";
      readonly question: string;
      readonly choices: readonly QuestionChoice[];
      /** The index of the choice to show as recommended. */
      readonly recommended: number;
    }
  | {
      readonly kind: "rejection";
      readonly reason: string;
      /** The parts of the request that were not made. Their changes apply to the design as it is. */
      readonly followUps?: readonly FollowUp[];
    };

export const OUTCOME_KINDS = ["applied", "question", "rejection"] as const satisfies readonly IntentOutcome["kind"][];

const FALLBACK_REASON = "That could not be done. Nothing was changed.";

export function rejection(reason: string, followUps: readonly FollowUp[] = []): Extract<IntentOutcome, { kind: "rejection" }> {
  const said = reason.trim();
  const shown = said === "" ? FALLBACK_REASON : said;
  return followUps.length === 0 ? { kind: "rejection", reason: shown } : { kind: "rejection", reason: shown, followUps };
}

const said = (text: string): boolean => text.trim() !== "";

const followUpsSaid = (followUps: readonly FollowUp[] | undefined): boolean =>
  (followUps ?? []).every((followUp) => said(followUp.text) && followUp.choices.every((choice) => said(choice.label)));

/**
 * True when the outcome tells the person something: a change explained, a question they
 * can answer, or a reason. The replay of the golden set asserts this on every case.
 */
export function isNeverSilent(outcome: IntentOutcome): boolean {
  switch (outcome.kind) {
    case "applied":
      return outcome.explanations.length > 0 && outcome.explanations.every(said) && followUpsSaid(outcome.followUps);
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
      return said(outcome.reason) && followUpsSaid(outcome.followUps);
  }
}
