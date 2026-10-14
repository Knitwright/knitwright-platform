import type { PatternPiece } from "@/lib/production/contract";
import { dist } from "../geometry";
import type { Seam } from "../seams";
import { foldFrame, lineNote } from "./frame";
import { reading, skip, type Outcome, type SizeSet } from "./types";

/** Points of measure read from the front and back pieces. */

const NEEDS = (piece: PatternPiece | undefined, role: string, names: readonly (keyof PatternPiece["landmarks"])[]): string | null => {
  if (!piece) return `This pattern has no ${role} piece.`;
  if (!foldFrame(piece)) return `The ${role} piece has no fold line to measure from.`;
  const missing = names.filter((name) => !piece.landmarks[name]);
  return missing.length > 0 ? `The ${role} piece has no ${missing.join(" or ")} landmark.` : null;
};

const seamOf = (set: SizeSet, pieceId: string | undefined, seamId: string): Seam | undefined =>
  pieceId ? set.seams.get(pieceId)?.find((s) => s.seamId === seamId) : undefined;

/** A width: twice the distance from the fold, straight across. */
function widthAt(set: SizeSet, pointId: string, landmark: "underarm" | "side-hem" | "hps", words: string): Outcome {
  const problem = NEEDS(set.front, "front", [landmark]);
  if (problem || !set.front) return skip(pointId, problem ?? "");
  const frame = foldFrame(set.front);
  const place = set.front.landmarks[landmark];
  if (!frame || !place) return skip(pointId, "The front piece cannot be measured.");
  return reading(pointId, 2 * frame.across(place), `${words}, twice the distance from the fold, on the front piece, ${lineNote(set.front)}.`);
}

function dropBetween(set: SizeSet, pointId: string, role: "front" | "back", other: "cf-neck" | "cb-neck"): Outcome {
  const piece = set[role];
  const problem = NEEDS(piece, role, ["hps", other]);
  if (problem || !piece) return skip(pointId, problem ?? "");
  const frame = foldFrame(piece);
  const [hps, low] = [piece.landmarks.hps, piece.landmarks[other]];
  if (!frame || !hps || !low) return skip(pointId, `The ${role} piece cannot be measured.`);
  return reading(pointId, Math.abs(frame.along(hps) - frame.along(low)), `From the high point of the shoulder down the fold to the lowest point of the ${role} neckline, ${lineNote(piece)}.`);
}

function bodyLength(set: SizeSet): Outcome {
  const problem = NEEDS(set.front, "front", ["hps", "cf-hem"]);
  const frame = set.front ? foldFrame(set.front) : null;
  const [hps, hem] = [set.front?.landmarks.hps, set.front?.landmarks["cf-hem"]];
  if (problem || !set.front || !frame || !hps || !hem) return skip("body-length", problem ?? "The front piece cannot be measured.");
  return reading("body-length", Math.abs(frame.along(hps) - frame.along(hem)), `On the front piece, along the fold from the high point of the shoulder to the hem, ${lineNote(set.front)}.`);
}

function shoulderWidth(set: SizeSet): Outcome {
  const problem = NEEDS(set.back, "back", ["shoulder-point"]);
  const frame = set.back ? foldFrame(set.back) : null;
  const point = set.back?.landmarks["shoulder-point"];
  if (problem || !set.back || !frame || !point) return skip("shoulder-width", problem ?? "The back piece cannot be measured.");
  return reading("shoulder-width", 2 * frame.across(point), `On the back piece, twice the distance from the fold to the shoulder point, ${lineNote(set.back)}.`);
}

function armholeStraight(set: SizeSet): Outcome {
  const [a, b] = [set.front?.landmarks.underarm, set.front?.landmarks["shoulder-point"]];
  if (!set.front || !a || !b) return skip("armhole", "The front piece has no underarm or shoulder point.");
  return reading("armhole", dist(a, b), `On the front piece, in a straight line from the shoulder point to the underarm, ${lineNote(set.front)}.`);
}

/** The back width halfway between the shoulder point and the underarm, where the armhole curve crosses that level. */
function acrossBack(set: SizeSet): Outcome {
  const back = set.back;
  const frame = back ? foldFrame(back) : null;
  const seam = seamOf(set, back?.id, "armhole-back");
  const [top, under] = [back?.landmarks["shoulder-point"], back?.landmarks.underarm];
  if (!back || !frame || !seam || !top || !under) return skip("across-back", "The back piece needs a fold line, a shoulder point, an underarm and an armhole curve.");
  const level = (frame.along(top) + frame.along(under)) / 2;
  for (let i = 1; i < seam.points.length; i += 1) {
    const [p, q] = [seam.points[i - 1], seam.points[i]];
    const [lp, lq] = [frame.along(p) - level, frame.along(q) - level];
    if (lp === 0 || lp * lq < 0) {
      const t = lp === 0 ? 0 : lp / (lp - lq);
      const across = frame.across([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      return reading("across-back", 2 * across, `On the back piece, twice the distance from the fold to the armhole curve, halfway between the shoulder point and the underarm, ${lineNote(back)}.`);
    }
  }
  return skip("across-back", "The armhole curve of the back does not cross the halfway level.");
}

function curveLengths(set: SizeSet, pointId: string, ids: readonly { role: "front" | "back"; seamId: string }[], words: string): Outcome {
  const seams = ids.map(({ role, seamId }) => seamOf(set, set[role]?.id, seamId));
  if (seams.some((s) => !s)) return skip(pointId, "The front and back pieces need their landmarks to measure this curve.");
  const total = seams.reduce((sum, s) => sum + (s?.lengthMm ?? 0), 0);
  return reading(pointId, total, words);
}

export function torsoReadings(set: SizeSet): Outcome[] {
  const note = set.front ? lineNote(set.front) : "";
  return [
    widthAt(set, "chest-width", "underarm", "Across the front at the underarm point"),
    bodyLength(set),
    shoulderWidth(set),
    armholeStraight(set),
    widthAt(set, "hem-width", "side-hem", "Across the front at the hem"),
    widthAt(set, "neck-width", "hps", "Across the neck opening between the two shoulder seams"),
    dropBetween(set, "front-neck-drop", "front", "cf-neck"),
    dropBetween(set, "back-neck-drop", "back", "cb-neck"),
    acrossBack(set),
    curveLengths(set, "armhole-curve", [{ role: "front", seamId: "armhole-front" }, { role: "back", seamId: "armhole-back" }], `Front armhole curve plus back armhole curve, along the line, ${note}.`),
    curveLengths(set, "neckline-length", [{ role: "front", seamId: "neckline-front" }, { role: "back", seamId: "neckline-back" }].flatMap((s) => [s, s]), `Front and back neckline curves, both halves, along the line, ${note}.`),
  ];
}
