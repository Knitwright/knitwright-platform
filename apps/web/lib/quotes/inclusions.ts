import { RULES } from "./settings";

/**
 * "What's included" (spec F-T5): the crest, the sponsors, and names and numbers. Each line says
 * whether it is in the price and which rulebook entry says so, because a club comparing two quotes
 * needs to know what is in the figure and not only what the figure is.
 */

export interface Inclusion {
  readonly id: string;
  readonly label: string;
  readonly included: boolean;
  /** Always a full sentence. It says what the club gets and what the price does about it. */
  readonly note: string;
  readonly ruleId: string;
}

export interface InclusionInput {
  readonly crest: boolean;
  /** How many sponsor marks the kit carries. The configurator offers three slots. */
  readonly sponsors: number;
  readonly namesNumbers: boolean;
}

/** Said on the crest line. The whole panel is printed either way, so the print adds nothing. */
export const CREST_NOTE =
  "Your crest is printed in the same pass as the shirt, so it adds nothing to the price: the whole panel is printed whether the design is plain or busy.";

export const NO_CREST_NOTE = "No crest is on this kit yet. Adding one does not change the price.";

export const sponsorNote = (count: number): string =>
  count === 0
    ? "No sponsor marks are on this kit yet. Adding up to three does not change the price."
    : `${count} sponsor ${count === 1 ? "mark is" : "marks are"} printed in the same pass as the shirt, so they add nothing to the price.`;

/**
 * Said on the names and numbers line. The rulebook's own per-piece figure for personalisation is a
 * placeholder from a supplier price list, not a partner's quote, so the line says that plainly
 * rather than showing a price per name.
 */
export const NAMES_NOTE =
  "Names and numbers are printed in the same sublimation pass, so there is no extra layer. The factory's own per-piece figure for them is a Knitwright placeholder, not a partner's price, so this quote does not show one.";

export const NO_NAMES_NOTE = "Names and numbers are off on this kit. Turning them on may change the price once a factory gives its figure.";

export function inclusionsFor(input: InclusionInput): readonly Inclusion[] {
  return [
    { id: "crest", label: "Your crest", included: input.crest, note: input.crest ? CREST_NOTE : NO_CREST_NOTE, ruleId: RULES.patternCost },
    { id: "sponsors", label: "Sponsor marks", included: input.sponsors > 0, note: sponsorNote(input.sponsors), ruleId: RULES.patternCost },
    {
      id: "names-numbers",
      label: "Names and numbers",
      included: input.namesNumbers,
      note: input.namesNumbers ? NAMES_NOTE : NO_NAMES_NOTE,
      ruleId: input.namesNumbers ? RULES.personalisationCost : RULES.personalisationMethod,
    },
  ];
}
