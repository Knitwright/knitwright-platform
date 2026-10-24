import type { RosterRow } from "@/lib/production/contract";

/** One bag to make. `teamRowPosition` is the line of the team list (1 is the first), or null for a plain bag of one size. */
export interface PlannedBag {
  readonly teamRowPosition: number | null;
  readonly sizeLabel: string;
  readonly pieces: number;
}

/** The most pieces the database lets one bag hold. A limit of the record, not a packing rule. */
export const BAG_PIECES_MAX = 999;
export const BAGS_MAX = 1000;

const bySize = (a: string, b: string): number => a.localeCompare(b, "en", { numeric: true });

/**
 * The bags of an order. With a team list: one bag per line, in list order, holding that line's pieces. Without one
 * (none, or it was erased): one bag per size, split when a size is over what a bag record holds. Pure.
 */
export function planBags(sizes: Readonly<Record<string, number>>, roster: readonly RosterRow[] | null): readonly PlannedBag[] {
  if (roster !== null && roster.length > 0) {
    return roster.map((r, i) => ({ teamRowPosition: i + 1, sizeLabel: r.sizeLabel, pieces: r.quantity }));
  }
  const bags: PlannedBag[] = [];
  for (const size of Object.keys(sizes).sort(bySize)) {
    for (let left = sizes[size] ?? 0; left > 0; left -= BAG_PIECES_MAX) {
      bags.push({ teamRowPosition: null, sizeLabel: size, pieces: Math.min(left, BAG_PIECES_MAX) });
    }
  }
  return bags;
}

/** A sentence when the bags cannot be recorded, or null. */
export const bagsProblem = (bags: readonly PlannedBag[]): string | null =>
  bags.length === 0 ? "There is nothing to pack." : bags.length > BAGS_MAX ? `An order has up to ${BAGS_MAX} bags.` : null;
