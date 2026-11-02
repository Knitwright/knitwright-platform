import type { OptionCodeMapping } from "./types";

/**
 * Reading the map: what one catalogue option group comes to for one design, and which of the design's own choices
 * the catalogue has no code for.
 *
 * Pure, and it invents nothing. A code comes out only from a `mapped` row, which exists only where a published
 * source says the registry choice and the catalogue code are the same thing. Everything else comes out as a gap
 * with the sentence a tech pack field shows, so no reader is handed Knitwright's own word dressed up as a code.
 */

/** What the design chose, as the design object holds it: the registry's own keys, or catalogue groups for codes. */
export type ChosenOptions = Readonly<Record<string, string>>;

export type GroupOutcome =
  /** A published source joins the design's choice to this catalogue code. */
  | Readonly<{ outcome: "code"; code: string; registryKey: string; registryChoice: string; ruleId: string }>
  /** The design chose something under a registry key this group is fed by, and no code covers it. */
  | Readonly<{ outcome: "no_code_yet"; registryKey: string; registryChoice: string; sentence: string; note: string | null }>
  /** Nothing in the design speaks to this group, so the article's own default stands. */
  | Readonly<{ outcome: "not_chosen"; note: string | null }>;

/** One of the design's own choices that the catalogue has no code for, for a field that says so plainly. */
export type UncodedChoice = Readonly<{ registryKey: string; registryChoice: string; sentence: string; note: string | null }>;

export const GAP_RULE = "R-GAP-000";

/**
 * What a tech pack field says where no code exists. It names the design's own word so the reader knows what was
 * asked for, and says in the same breath that it is not a catalogue code, so it can never be read as one.
 */
export const noCodeSentence = (registryKey: string, registryChoice: string): string =>
  `No catalogue code yet: the design asked for "${registryChoice}" under the design option "${registryKey}", and nothing published joins it to a code.`;

const forGroup = (map: readonly OptionCodeMapping[], group: string): readonly OptionCodeMapping[] =>
  map.filter((row) => row.optionGroup === group);

/** The key and the choice this row is about, when the design really made that choice, or undefined. */
function askedOf(row: OptionCodeMapping, chosen: ChosenOptions): { readonly key: string; readonly choice: string } | undefined {
  const key = row.registryKey;
  if (key === null) return undefined;
  const choice = chosen[key];
  if (choice === undefined) return undefined;
  if (row.registryChoice !== null && row.registryChoice !== choice) return undefined;
  return { key, choice };
}

/**
 * The catalogue code for one option group of one design, or the gap in its place.
 *
 * A group is fed by whichever registry key the map binds to it — which is not the key of the same name. The
 * catalogue's `collar` group is the neck finish (`C01` to `C03`) and the registry key that feeds it is `neckline`;
 * the registry's own `collar` key asks about a stand collar, which this article has no code for at all. Reading
 * `collar` from the design into the `collar` group would put the answer to one question under another.
 */
export function codeForGroup(map: readonly OptionCodeMapping[], group: string, chosen: ChosenOptions): GroupOutcome {
  const rows = forGroup(map, group);
  for (const row of rows) {
    const code = row.optionCode;
    if (code === null) continue;
    const asked = askedOf(row, chosen);
    if (asked === undefined) continue;
    return { outcome: "code", code, registryKey: asked.key, registryChoice: asked.choice, ruleId: row.ruleId };
  }
  for (const row of rows) {
    if (row.kind !== "no_code_yet") continue;
    const asked = askedOf(row, chosen);
    if (asked === undefined) continue;
    return {
      outcome: "no_code_yet",
      registryKey: asked.key,
      registryChoice: asked.choice,
      sentence: noCodeSentence(asked.key, asked.choice),
      note: row.note,
    };
  }
  return { outcome: "not_chosen", note: rows.find((row) => row.registryKey === null)?.note ?? null };
}

/**
 * Every choice the design made that the catalogue has no code for and no group to put it in: the stand collar, the
 * placket, the side panels and the vented hem of a jersey. They would otherwise leave no trace in a factory file at
 * all, so each becomes a field of its own saying there is no code for it yet.
 */
export function uncodedChoices(map: readonly OptionCodeMapping[], chosen: ChosenOptions): readonly UncodedChoice[] {
  return map.flatMap((row) => {
    if (row.kind !== "no_code_yet" || row.optionGroup !== null) return [];
    const asked = askedOf(row, chosen);
    if (asked === undefined) return [];
    return [{ registryKey: asked.key, registryChoice: asked.choice, sentence: noCodeSentence(asked.key, asked.choice), note: row.note }];
  });
}

/** The registry keys the map binds to a catalogue group, so a caller can see which questions carry codes. */
export const boundRegistryKeys = (map: readonly OptionCodeMapping[], group: string): readonly string[] => [
  ...new Set(forGroup(map, group).flatMap((row) => (row.registryKey === null ? [] : [row.registryKey]))),
];
