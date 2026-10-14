import { POINT_LABELS, pointLabel } from "./labels";

/** The measured table of a block: every point, every size, in centimetres. Pure, so the screen only draws it. */

export type MeasuredSize = Readonly<{
  size: string;
  measurements: readonly { pointId: string; tenthsMm: number; method: string }[];
  skipped: readonly { pointId: string; reason: string }[];
}>;

export type TableRow = Readonly<{
  pointId: string;
  label: string;
  /** Centimetres to one decimal, or null where the pattern gives no figure at this size. */
  cells: readonly (string | null)[];
  /** The sentence for a point that could not be measured at any size, or how it was measured. */
  note: string;
}>;

export const cmText = (tenthsMm: number): string => (tenthsMm / 100).toFixed(1);

export function measuredTable(sizes: readonly MeasuredSize[]): { sizes: readonly string[]; rows: readonly TableRow[] } {
  const known = new Set(POINT_LABELS.map(([id]) => id));
  const seen = new Set<string>();
  for (const s of sizes) for (const id of [...s.measurements.map((m) => m.pointId), ...s.skipped.map((k) => k.pointId)]) seen.add(id);
  const order = [...POINT_LABELS.map(([id]) => id).filter((id) => seen.has(id)), ...[...seen].filter((id) => !known.has(id)).sort()];
  const rows = order.map((pointId): TableRow => {
    const cells = sizes.map((s) => {
      const found = s.measurements.find((m) => m.pointId === pointId);
      return found ? cmText(found.tenthsMm) : null;
    });
    const method = sizes.flatMap((s) => s.measurements.filter((m) => m.pointId === pointId)).at(0)?.method;
    const reason = sizes.flatMap((s) => s.skipped.filter((k) => k.pointId === pointId)).at(0)?.reason;
    return { pointId, label: pointLabel(pointId), cells, note: method ?? reason ?? "" };
  });
  return { sizes: sizes.map((s) => s.size), rows };
}
