import type { TechPack } from "../types";
import { length, lengthColumn, table, text, textColumn, type ExportTable } from "./table-types";

const STATUS_WORDS = {
  inside: "Inside the tolerance",
  outside: "Outside the tolerance",
  "no-target": "No target",
  "no-tolerance": "No tolerance",
  "not-measured": "Not measured",
} as const;

/** The measurement table set against the pattern: two tables, appended to the measurements section. */
export function onPatternTables(pack: TechPack): readonly ExportTable[] {
  const onPattern = pack.measurements.onPattern;
  if (onPattern === null) return [];
  const rows = onPattern.rows.flatMap((row) =>
    row.cells.map((cell) => [
      text(row.code),
      text(row.label),
      text(cell.size),
      length(cell.target),
      length(cell.measured),
      length(cell.difference),
      length(row.tolerance),
      text(STATUS_WORDS[cell.status]),
      text(cell.flag ?? ""),
    ]),
  );
  const main = table(
    "Measured on the pattern",
    [textColumn("Code"), textColumn("Measurement"), textColumn("Pattern size"), lengthColumn("Target"), lengthColumn("Measured"), lengthColumn("Difference"), lengthColumn("Tolerance", "± cm"), textColumn("Result"), textColumn("Note")],
    rows,
    onPattern.summary,
  );
  if (onPattern.patternOnly.length === 0) return [main];
  const only = table(
    "Points only a pattern gives",
    [textColumn("Point"), textColumn("Pattern size"), lengthColumn("Measured"), textColumn("How it was measured")],
    onPattern.patternOnly.flatMap((row) => row.cells.map((cell) => [text(row.label), text(cell.size), length(cell.measured), text(row.method)])),
  );
  return [main, only];
}
