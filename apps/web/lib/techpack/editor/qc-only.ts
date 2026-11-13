import type { ViewCell } from "../view/fields";
import type { TechPackTabId } from "../view/tabs";

/**
 * 🔒 rows: the values only Knitwright QC edits (spec `08` v3.7: "🔒 marks rows that only Knitwright
 * QC edits (sample size, factory, AQL)"). A founder sees them and cannot change them; the editor draws
 * a lock with the reason, and an empty one says who fills it rather than asking the founder.
 */

/** The cells, by id, that only Knitwright QC edits wherever they appear. */
export const QC_ONLY_CELLS: readonly string[] = ["sample-size", "body-sample", "factory"];

/** The tabs whose every cell is QC's: the inspection plan, the points to measure, the photographs. */
export const QC_ONLY_TABS: readonly TechPackTabId[] = ["qc"];

/** The tooltip on a 🔒 row. */
export const QC_ONLY_REASON = "Only Knitwright QC edits this, after the golden sample.";

/** What an empty 🔒 row reads, in place of asking the founder for it. */
export const QC_FILLS = "Set by Knitwright QC";

export const isQcOnly = (cell: Pick<ViewCell, "id">, from: TechPackTabId): boolean =>
  QC_ONLY_TABS.includes(from) || QC_ONLY_CELLS.includes(cell.id);
