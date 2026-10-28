import type { PatternMeasurement, PatternPiece } from "@/lib/production/contract";
import { seamsOf } from "../seams";
import { pieceRole } from "../landmarks";
import { capEase, collarReadings, sleeveReadings } from "./sleeve";
import { torsoReadings } from "./torso";
import { isSkip, skip, type Outcome, type SizeMeasures, type SizeSet } from "./types";

export type { Skip } from "./types";
export { compareToTargets } from "./compare";

/** The points of measure for tops that the registry names (lib/garment/registry/tops). */
export const TOPS_POINT_IDS = [
  "chest-width", "body-length", "shoulder-width", "sleeve-length", "armhole", "upper-arm", "sleeve-opening",
  "hem-width", "neck-width", "front-neck-drop", "back-neck-drop", "collar-height", "placket-length", "placket-width",
] as const;

/** Points only a pattern can give: the curves, the cap, the collar piece and the back width. */
export const PATTERN_ONLY_IDS = ["cap-height", "armhole-curve", "cap-curve", "cap-ease", "neckline-length", "collar-cut-length", "across-back"] as const;

const NO_PLACKET = "This pattern has no placket piece.";

function setOf(size: string, pieces: readonly PatternPiece[]): SizeSet {
  const piece = (role: "front" | "back" | "sleeve" | "collar"): PatternPiece | undefined => pieces.find((p) => pieceRole(p.id) === role);
  return { size, front: piece("front"), back: piece("back"), sleeve: piece("sleeve"), collar: piece("collar"), seams: seamsOf(pieces) };
}

const tenths = (mm: number): number => Math.round(mm * 10);

/**
 * Every point of measure a pattern can give, read from the pieces of one size, in tenths of a
 * millimetre. A point that cannot be read is listed with the reason, never filled in.
 */
export function measurePattern(size: string, pieces: readonly PatternPiece[]): SizeMeasures {
  const set = setOf(size, pieces);
  const outcomes: Outcome[] = [...torsoReadings(set), ...sleeveReadings(set), ...collarReadings(set)];
  const value = (id: string): number | undefined => {
    const found = outcomes.find((o) => o.pointId === id);
    return found && !isSkip(found) ? found.mm : undefined;
  };
  outcomes.push(capEase(value("cap-curve"), value("armhole-curve")));
  outcomes.push(skip("placket-length", NO_PLACKET), skip("placket-width", NO_PLACKET));
  const measurements: PatternMeasurement[] = [];
  for (const outcome of outcomes) {
    if (isSkip(outcome)) continue;
    measurements.push({ pointId: outcome.pointId, size, tenthsMm: tenths(outcome.mm), source: "measured-from-pattern", method: outcome.method });
  }
  return { measurements, skipped: outcomes.filter(isSkip) };
}
