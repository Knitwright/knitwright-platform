/**
 * Undo goes back through the designs a person actually made, not between two states. A
 * version that restored another holds the same design as the one it restored, so what
 * counts is the origin of the current version: itself, or the origin of the version it
 * restored. Undo goes to the version before that origin.
 */

export type HistoryRow = Readonly<{ version: number; restoredFrom: number | null }>;

/** The version whose design this version holds. Stops at a version that is not listed. */
export const originOf = (rows: readonly HistoryRow[], version: number): number => {
  const restoredFrom = new Map(rows.map((row) => [row.version, row.restoredFrom]));
  const seen = new Set<number>();
  let current = version;
  for (let next = restoredFrom.get(current); next != null && !seen.has(current); next = restoredFrom.get(current)) {
    seen.add(current);
    current = next;
  }
  return current;
};

/** The version an undo goes to, or null when there is nothing before the current design. */
export const undoTarget = (rows: readonly HistoryRow[]): number | null => {
  if (rows.length === 0) return null;
  const current = Math.max(...rows.map((row) => row.version));
  const before = originOf(rows, current) - 1;
  return before >= 1 ? before : null;
};
