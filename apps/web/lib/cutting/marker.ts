import type { PatternPiece, Point } from "@/lib/production/contract";
import { outlineArea } from "@/lib/production/geometry/offset";
import { boundsOf, grainAngleDeg, openedOutline, rotateAll } from "./geometry";

/** The words every fabric-use number carries until a real marker exists. */
export const ESTIMATE_LABEL = "Knitwright default, not from a marker";

/** One piece to lay on the fabric: its whole outline as it lies flat, and how many are cut. */
export type MarkerItem = Readonly<{
  id: string;
  outline: readonly Point[];
  /** The grain line's angle in the pattern file, or null when the piece has none. */
  grainAngleDeg: number | null;
  copies: number;
}>;

export type MarkerInput = Readonly<{ items: readonly MarkerItem[]; widthMm: number; gapMm?: number }>;

export type MarkerResult = Readonly<{
  /** Fabric length used, in millimetres. */
  lengthMm: number;
  /** Piece area over the fabric area used, between 0 and 1. */
  efficiency: number;
  fits: boolean;
  /** Ids of pieces that cannot be laid on this width. */
  unplaced: readonly string[];
  label: string;
  sentence: string;
}>;

/** What a marker maker implements. Today's estimator and a future nesting engine share it. */
export interface MarkerProvider {
  readonly name: string;
  readonly label: string;
  estimate(input: MarkerInput): MarkerResult;
}

const DEFAULT_GAP_MM = 5;

type Box = Readonly<{ id: string; along: number; across: number; area: number }>;

/** The piece turned so its grain runs along the fabric, then boxed. No grain line: laid as drawn. */
function boxOf(item: MarkerItem): Box {
  const turned = item.grainAngleDeg === null ? item.outline : rotateAll(item.outline, (-item.grainAngleDeg * Math.PI) / 180);
  const box = boundsOf(turned);
  return { id: item.id, along: box.width, across: box.height, area: outlineArea(item.outline) };
}

function expand(items: readonly MarkerItem[]): Box[] {
  return items
    .flatMap((item) => Array.from({ length: item.copies }, () => boxOf(item)))
    .sort((a, b) => b.along - a.along || b.across - a.across || a.id.localeCompare(b.id));
}

/**
 * Lays a box round each piece on strips across the fabric, longest first, so the answer is the
 * same whatever order the pieces arrive in. Boxes waste more fabric than a real marker, so the
 * length is a cautious estimate, and it says so.
 */
export const stripPackingEstimator: MarkerProvider = {
  name: "strip-packing",
  label: ESTIMATE_LABEL,
  estimate({ items, widthMm, gapMm = DEFAULT_GAP_MM }) {
    if (!(widthMm > 0)) throw new RangeError("The fabric needs a width above zero.");
    const boxes = expand(items);
    const unplaced = [...new Set(boxes.filter((b) => b.across > widthMm).map((b) => b.id))].sort();
    const placeable = boxes.filter((b) => b.across <= widthMm);
    let length = 0;
    let used = 0;
    let stripAlong = 0;
    for (const box of placeable) {
      const fits = used > 0 && used + gapMm + box.across <= widthMm;
      if (!fits) {
        length += stripAlong;
        stripAlong = box.along;
        used = box.across;
      } else {
        used += gapMm + box.across;
      }
    }
    length += stripAlong;
    const area = placeable.reduce((sum, b) => sum + b.area, 0);
    const efficiency = length > 0 ? Math.min(1, area / (length * widthMm)) : 1;
    return {
      lengthMm: length,
      efficiency,
      fits: unplaced.length === 0,
      unplaced,
      label: ESTIMATE_LABEL,
      sentence:
        unplaced.length === 0
          ? "Estimated by laying a box round each piece. A real marker is usually tighter."
          : `Cannot lay ${unplaced.join(", ")}: wider than the fabric.`,
    };
  },
};

/** The pieces of one size as marker items, folds opened out. */
export function markerItemsFor(pieces: readonly PatternPiece[]): readonly MarkerItem[] {
  return pieces.map((p) => ({
    id: p.id,
    outline: openedOutline(p.cutOutline, p.onFold ? p.foldLine : null),
    grainAngleDeg: p.grainLine ? grainAngleDeg(p.grainLine) : null,
    copies: p.quantity,
  }));
}
