import { NAME_PROBLEM } from "@/lib/orders/text";
import { gap, held, type Known } from "./gap";

/**
 * The personalisation rules the Store must apply before it takes a name or a number (plan v5 O2;
 * Z7's rows, decision 0086).
 *
 * All of it is rows. `shirt_zone_limits` says how many characters each printed zone takes and
 * `sport_number_rules` says which numbers a sport allows, each with the rule that explains it and a
 * note saying where the figure came from. Both are carried into the payload with those notes
 * attached, because most of them are Knitwright drafts no league rule book has been read against,
 * and a Store that showed them as settled rules would be overstating them.
 *
 * The character rule is not a row: it is `cleanName` in `lib/orders/text.ts`, the one function every
 * typed name in the platform goes through. Its own sentence is carried here word for word, so the
 * Store refuses the same names this platform would and the wearer reads one explanation, not two.
 */

/** One printed zone and the longest text it takes. */
export interface PersonalisationZone {
  readonly zone: string;
  readonly label: string;
  readonly maxCharacters: number;
  readonly ruleId: string;
  /** Where the figure came from, word for word from the row. */
  readonly note: string;
}

/** The numbers one sport allows. */
export interface NumberRule {
  readonly sport: string;
  readonly label: string;
  readonly lowest: number;
  readonly highest: number;
  /** Whether "07" keeps its leading zero. Some codes print one. */
  readonly leadingZeroAllowed: boolean;
  readonly ruleId: string;
  readonly note: string;
}

export type StorePersonalisation = Known<{
  zones: readonly PersonalisationZone[];
  numbers: readonly NumberRule[];
  /** The character rule every typed name is held to, in the platform's own words. */
  nameCharacters: string;
  /** Said plainly: a name the Store takes is screened again here before anything is printed. */
  screening: string;
}>;

export const SCREENING =
  "A name or a number the Store takes is screened again by Knitwright before it reaches a print file, so the Store taking it is not the last word on it.";

const NOTHING_ON_FILE = "the printed zones and the number ranges";

/**
 * The rules as the contract carries them, zones in the order the rows give and sports by name. With
 * no rows at all this is a gap, not an empty list: an empty list reads as "no limits", which would
 * let a Store take a name no shirt can hold.
 */
export function storePersonalisation(
  zones: readonly PersonalisationZone[],
  numbers: readonly NumberRule[],
): StorePersonalisation {
  if (zones.length === 0 || numbers.length === 0) {
    return gap(
      [NOTHING_ON_FILE],
      `Knitwright holds no rows for ${NOTHING_ON_FILE}, so the Store has no limit to apply and must take no name or number until it does.`,
    );
  }
  return held({
    zones: [...zones],
    numbers: [...numbers].sort((a, b) => a.sport.localeCompare(b.sport)),
    nameCharacters: NAME_PROBLEM,
    screening: SCREENING,
  });
}
