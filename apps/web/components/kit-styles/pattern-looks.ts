import { GAP_RULE_ID } from "@/lib/rulebook/constants";

/**
 * What a founder may do with one of the pattern looks the platform can draw (decision 0037, W7c),
 * said in plain words under its picture.
 *
 * The library of looks is wider than what a design can hold. `GENERATORS` draws seventeen styles;
 * a stored design carries `kitPattern`, which holds **eight**, so a look outside those eight can be
 * drawn and not saved. `lib/panel-layers/library.ts` says the same thing about the same list, in
 * the same words, rather than offering a button that would do nothing.
 *
 * No note here claims a manufacturing fact, so each carries `R-GAP-000`: no rulebook entry says
 * which pattern a garment may be printed with.
 */

/** The prefix the eight older kit styles carry in the generator registry (`kit-hoops`, `kit-sash`). */
const KIT_PREFIX = "kit-";

export type LookNote = Readonly<{
  /** `pickable` is a look this very garment offers above; the others cannot be saved on this design. */
  kind: "pickable" | "other-garment" | "not-stored";
  text: string;
  ruleId: string;
}>;

/** The kit style a generator draws, or null for one no stored design can hold. */
export const kitStyleOf = (generatorId: string): string | null =>
  generatorId.startsWith(KIT_PREFIX) ? generatorId.slice(KIT_PREFIX.length) : null;

/**
 * The note under one look's picture. `offered` is the kit styles this garment offers, which is what
 * the gallery above is drawn from, so the two can never disagree about what may be picked.
 */
export function lookNote(generatorId: string, offered: readonly string[]): LookNote {
  const style = kitStyleOf(generatorId);
  if (style !== null && offered.includes(style)) {
    return { kind: "pickable", text: "Pick this one above, drawn on your own garment in your colours.", ruleId: GAP_RULE_ID };
  }
  if (style !== null) {
    return { kind: "other-garment", text: "Another garment offers this style; this one does not, so it cannot go on this design.", ruleId: GAP_RULE_ID };
  }
  return {
    kind: "not-stored",
    text: "A design can only store the eight kit styles today, so this look cannot be saved on one yet. The repeat maker publishes a tile into your own library instead.",
    ruleId: GAP_RULE_ID,
  };
}
