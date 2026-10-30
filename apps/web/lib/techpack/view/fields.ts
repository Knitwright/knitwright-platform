import { FIELD_PROVENANCE, GAP_RULE, type FieldProvenance } from "@/lib/kpp/model";
import type { LengthUnit } from "./units";
import { formatLengthWithUnit } from "./units";

/**
 * The one shape every cell of the tech pack view has, and the provenance chip that goes with it
 * (spec F-S6: "Every field shows provenance: **From base** (green), **From design** (blue),
 * **Needs your input** (amber), **Confirmed**").
 *
 * The four words are not this workstream's own: they are `FIELD_PROVENANCE` from the production
 * package's model (X5, decision 0070), which took them from `docs/spec/04-production-package.md`.
 * The tech pack view and the package a factory receives therefore label a value's source with the
 * same word, and a rename breaks both at once rather than letting them drift apart.
 */
export type { FieldProvenance };
export { FIELD_PROVENANCE, GAP_RULE };

/** The order the chips are explained in, and the legend above the tabs. */
export const PROVENANCE_ORDER: readonly FieldProvenance[] = ["from_base", "from_design", "needs_input", "confirmed"];

/** One word per chip. Single words, so nothing here can read as a sentence claiming a fact. */
export const PROVENANCE_CHIPS: Readonly<Record<FieldProvenance, string>> = {
  from_base: "From base",
  from_design: "From design",
  needs_input: "Needs your input",
  confirmed: "Confirmed",
};

/** The colour the spec gives each chip, as a token this product's styles already carry. */
export const PROVENANCE_TONE: Readonly<Record<FieldProvenance, "green" | "blue" | "amber" | "neutral">> = {
  from_base: "green",
  from_design: "blue",
  needs_input: "amber",
  confirmed: "neutral",
};

/**
 * One readable cell of the view. `text` is null while nobody has the value, and a null is never
 * drawn as a zero, a dash with a number in it or `[TBC]`: the chip says "Needs your input" and the
 * Review tab counts it.
 */
export type ViewCell = Readonly<{
  /** Names the cell inside its tab, so the Review tab can take a person to it. */
  id: string;
  label: string;
  text: string | null;
  provenance: FieldProvenance;
  /** The rulebook entry that explains the value. `R-GAP-000` where the source names no rule. */
  ruleId: string;
  /** True for a value the base article fixes: it is drawn with a lock and a "Why?" (spec F-S6 rules). */
  locked: boolean;
}>;

type CellInit = Readonly<{
  id: string;
  label: string;
  text?: string | null;
  provenance: FieldProvenance;
  ruleId?: string | null;
  locked?: boolean;
}>;

/**
 * A cell. A value nobody has is `needs_input` whatever the caller asked for, so no empty cell can
 * ever wear a chip that says the base or the design supplied it.
 */
export function cell(init: CellInit): ViewCell {
  const text = init.text === undefined || init.text === null || init.text.trim() === "" ? null : init.text;
  return {
    id: init.id,
    label: init.label,
    text,
    provenance: text === null ? "needs_input" : init.provenance,
    ruleId: init.ruleId === undefined || init.ruleId === null || init.ruleId === "" ? GAP_RULE : init.ruleId,
    locked: text === null ? false : (init.locked ?? false),
  };
}

/** A cell the base article fixes: locked, with its rule, and drawn with a lock and a "Why?". */
export const fromBase = (init: Omit<CellInit, "provenance" | "locked">): ViewCell =>
  cell({ ...init, provenance: "from_base", locked: true });

/** A cell the person's own design supplies. */
export const fromDesign = (init: Omit<CellInit, "provenance" | "locked">): ViewCell => cell({ ...init, provenance: "from_design" });

/** A cell nothing fills yet, with the rule that says who fills it. */
export const needsInput = (init: Omit<CellInit, "provenance" | "text" | "locked">): ViewCell =>
  cell({ ...init, text: null, provenance: "needs_input" });

/** A length from the base article, read in the chosen unit. */
export const baseLength = (init: Omit<CellInit, "provenance" | "text" | "locked"> & { mm: number | null }, unit: LengthUnit): ViewCell =>
  fromBase({ ...init, text: formatLengthWithUnit(init.mm, unit) });

export const isNeedsInput = (entry: ViewCell): boolean => entry.provenance === "needs_input";

/** How many cells of each provenance a list holds, for the legend's counts. */
export function countProvenance(cells: readonly ViewCell[]): Readonly<Record<FieldProvenance, number>> {
  const counts: Record<FieldProvenance, number> = { from_base: 0, from_design: 0, needs_input: 0, confirmed: 0 };
  for (const entry of cells) counts[entry.provenance] += 1;
  return counts;
}
