import { OUTPUT_LABELS, type EntryKind, type OutputKind } from "./kinds";

/**
 * One line of a brand's credit ledger. The ledger is append-only: a line is never edited or
 * removed, and the balance is the sum of the amounts. A grant and a refund add credits; a spend
 * and an expiry take them away, so `amount` is signed.
 */
export type LedgerEntry = Readonly<{
  id: string;
  kind: EntryKind;
  amount: number;
  outputKind: OutputKind | null;
  /** The saved version of the design a spend or refund is about. */
  designVersionHash: string | null;
  /** For a refund, the spend it gives back. */
  refundOf: string | null;
  idempotencyKey: string;
  note: string;
  createdAt: string;
}>;

export const balanceOf = (entries: readonly LedgerEntry[]): number =>
  entries.reduce((sum, entry) => sum + entry.amount, 0);

export type HistoryRow = LedgerEntry & Readonly<{ balanceAfter: number }>;

/**
 * Newest first, each with the balance once it was applied. Entries are given oldest first.
 * `opening` is the balance before the first entry, for a history that is only the latest lines.
 */
export const withRunningBalance = (entries: readonly LedgerEntry[], opening = 0): readonly HistoryRow[] => {
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt) || a.index - b.index);
  let running = opening;
  const rows = ordered.map(({ entry }) => {
    running += entry.amount;
    return { ...entry, balanceAfter: running };
  });
  return rows.reverse();
};

/** What a line says, in plain words. */
export const describeEntry = (entry: LedgerEntry): string => {
  const what = entry.outputKind ? OUTPUT_LABELS[entry.outputKind].toLowerCase() : "an output";
  switch (entry.kind) {
    case "grant":
      return entry.note ? `Credits added: ${entry.note}` : "Credits added";
    case "spend":
      return `Used for ${what}`;
    case "refund":
      return `Given back: the design was ordered (${what})`;
    case "expire":
      return "Credits ran out";
  }
};
