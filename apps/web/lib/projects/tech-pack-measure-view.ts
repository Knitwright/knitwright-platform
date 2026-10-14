import { TO_BE_CONFIRMED, sourceLabel, type LengthValue, type MeasureRow, type SizeColumn } from "@/lib/techpack";
import { toneOf } from "./provenance-tone";
import type { CellTone } from "./tech-pack-view";

/**
 * The compact measurement table of the factory file: one number per size in centimetres, the
 * base size marked, the tolerance, and the sources of the row named once beside it. Every value
 * keeps its own source too, for the phone cards and for a pointer resting on it.
 */

export interface MeasureHead {
  readonly label: string;
  readonly isBase: boolean;
  /** The label beside a value when the table is stacked into cards on a phone. */
  readonly phone: string;
}

export interface MeasureCellView {
  readonly text: string;
  readonly tone: CellTone;
  readonly isBase: boolean;
  /** Where the value came from, in words, or null when it is empty. */
  readonly source: string | null;
}

export interface MeasureRowView {
  readonly cells: readonly MeasureCellView[];
  readonly tolerance: MeasureCellView;
  /** Each source of the row's values, once, in the order they first appear. */
  readonly sources: readonly string[];
}

export const measureHeads = (columns: readonly SizeColumn[]): readonly MeasureHead[] =>
  columns.map((column) => ({ label: column.label, isBase: column.isBase, phone: column.isBase ? `${column.label} (base size)` : column.label }));

function cellOf(cell: LengthValue, isBase: boolean): MeasureCellView {
  if (cell.status !== "set") return { text: TO_BE_CONFIRMED, tone: "missing", isBase, source: null };
  return { text: cell.value, tone: toneOf(cell.provenance), isBase, source: sourceLabel(cell) };
}

export function measureRowView(row: MeasureRow, columns: readonly SizeColumn[]): MeasureRowView {
  const cells = row.values.map((value, index) => cellOf(value, columns[index]?.isBase ?? false));
  const tolerance = cellOf(row.tolerance, false);
  const sources = [...cells, tolerance].flatMap((cell) => (cell.source === null ? [] : [cell.source]));
  return { cells, tolerance, sources: [...new Set(sources)] };
}
