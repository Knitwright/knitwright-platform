import { formatCm } from "@/lib/garment";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { TBC, type LengthValue } from "../cell";
import { centroid } from "./geometry";

interface Reference {
  /** The coordinate along the length of the piece where the measuring starts (the high point of shoulder, or the top of the cap). */
  readonly top: number;
  /** The coordinate across the piece of its centre line (centre front, centre back, or the middle of a sleeve). */
  readonly centre: number;
}

const FIRST_CENTRE = ["cf-hem", "cb-hem", "cf-neck", "cb-neck"] as const;

/**
 * The benchmark's DXF axes are kept in a piece: x runs along the length, larger x towards the neck,
 * and y runs across, from the fold. A torso piece is measured from the high point of shoulder and
 * its centre line; a sleeve from the top of the cap and the middle of the sleeve.
 */
export function referenceOf(piece: PatternPiece): Reference | null {
  const { hps, "cap-top": cap, "underarm-a": a, "underarm-b": b } = piece.landmarks;
  if (hps) {
    const centre = FIRST_CENTRE.map((id) => piece.landmarks[id]).find((point): point is Point => point !== undefined);
    return centre ? { top: hps[0], centre: centre[1] } : null;
  }
  if (cap && a && b) return { top: cap[0], centre: (a[1] + b[1]) / 2 };
  return null;
}

const toLength = (mm: number): LengthValue => {
  return { status: "set", value: formatCm(mm * 10), tenthsMm: Math.round(mm * 10), provenance: "measured-from-pattern" };
};

/** How far below the reference the top of a zone is, and how far its middle is from the centre line. */
export function placementOf(piece: PatternPiece | undefined, polygon: readonly Point[]): { down: LengthValue; across: LengthValue } {
  const ref = piece ? referenceOf(piece) : null;
  if (!ref || polygon.length === 0) return { down: TBC, across: TBC };
  const topOfZone = Math.max(...polygon.map(([x]) => x));
  return { down: toLength(ref.top - topOfZone), across: toLength(Math.abs(centroid(polygon)[1] - ref.centre)) };
}
