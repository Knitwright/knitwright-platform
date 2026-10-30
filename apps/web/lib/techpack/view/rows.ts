import type { Cell } from "../cell";
import { cell, isNeedsInput, type FieldProvenance, type ViewCell } from "./fields";
import type { TechPackTabId } from "./tabs";
import { TAB_LABELS, TAB_LEADS } from "./tabs";

/**
 * The shapes every tab of the tech pack view is made of: a list of fields, and tables of them.
 * One shape for all ten content tabs means the panel draws them with one component, the Review tab
 * can walk them all to find what is still empty, and the export values of a tab are read the same
 * way whichever tab it is (`export-values.ts`), which is what makes the Excel and the PDF carry
 * identical values.
 */

export type ViewRow = Readonly<{
  /** Names the row inside its table. */
  id: string;
  /** What the row is called, for a screen reader and for the Review tab's wording. */
  label: string;
  cells: readonly ViewCell[];
}>;

export type ViewTable = Readonly<{
  id: string;
  title: string;
  columns: readonly string[];
  rows: readonly ViewRow[];
  /** What the "+" button of this table would add, or null when the table takes no additions (spec F-S6). */
  addLabel: string | null;
  note: string | null;
}>;

export type TabSection = Readonly<{
  id: string;
  title: string;
  note: string | null;
  fields: readonly ViewCell[];
  tables: readonly ViewTable[];
}>;

export type TabView = Readonly<{
  id: TechPackTabId;
  label: string;
  lead: string;
  sections: readonly TabSection[];
}>;

export const section = (init: Partial<TabSection> & Pick<TabSection, "id" | "title">): TabSection => ({
  note: null,
  fields: [],
  tables: [],
  ...init,
});

export const table = (init: Partial<ViewTable> & Pick<ViewTable, "id" | "title" | "columns" | "rows">): ViewTable => ({
  addLabel: null,
  note: null,
  ...init,
});

export const tab = (id: TechPackTabId, sections: readonly TabSection[]): TabView => ({
  id,
  label: TAB_LABELS[id],
  lead: TAB_LEADS[id],
  sections,
});

/** Every cell of a tab, fields first and then each table's rows, in reading order. */
export const cellsOf = (view: TabView): readonly ViewCell[] =>
  view.sections.flatMap((part) => [...part.fields, ...part.tables.flatMap((entry) => entry.rows.flatMap((row) => row.cells))]);

/** Every cell of a tab that nothing fills yet. */
export const emptyCellsOf = (view: TabView): readonly ViewCell[] => cellsOf(view).filter(isNeedsInput);

/**
 * One of the existing tech pack's cells as a cell of this view. A value in the design object came
 * from the design, whichever of the garment spec's own sources it carries, and a value nobody has
 * is "Needs your input". The caller may say the value came from the base instead, for a row the base
 * article fixes.
 */
export function fromCell(
  init: Readonly<{ id: string; label: string; ruleId?: string | null; provenance?: FieldProvenance }>,
  source: Cell,
): ViewCell {
  return cell({
    id: init.id,
    label: init.label,
    text: source.status === "set" ? source.value : null,
    provenance: init.provenance ?? "from_design",
    ruleId: init.ruleId ?? null,
  });
}
