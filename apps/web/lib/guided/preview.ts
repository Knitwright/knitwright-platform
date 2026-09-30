import type { MeasurementTable } from "@/lib/projects/measurement-table";
import { formatLength, type LengthUnit } from "@/lib/units/length";

/**
 * The read-only measurements shown beside the drawing in the guided flow (plan step 15, task 2),
 * in centimetres or inches. Values are stored as whole tenths of a millimetre; the unit only
 * changes how they are written.
 */

export interface PreviewRow {
  readonly pointId: string;
  readonly label: string;
  readonly value: string;
  /** Where the value came from, in plain words, or null when there is none. */
  readonly source: string | null;
}

export const NOT_GIVEN = "Not given yet";

const TENTHS_PER_CM = 100;

export function previewRows(table: MeasurementTable, unit: LengthUnit): readonly PreviewRow[] {
  return table.groups.flatMap((group) =>
    group.rows.map((row) => ({
      pointId: row.pointId,
      label: row.label,
      value: row.hasValue && row.valueTenths !== null ? formatLength(row.valueTenths / TENTHS_PER_CM, unit) : NOT_GIVEN,
      source: row.hasValue ? row.provenanceLabel : null,
    })),
  );
}

export const previewTitle = (table: MeasurementTable): string =>
  table.size ? `Measurements for size ${table.size}` : "Measurements";
