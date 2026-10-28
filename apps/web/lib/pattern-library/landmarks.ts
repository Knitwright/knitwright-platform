import type { LandmarkId, PatternPiece, Point } from "@/lib/production/contract";
import { LANDMARK_IDS } from "@/lib/production/contract";
import { dot, dist, mid, nearestVertex, round2, sub } from "./geometry";

/**
 * Landmarks are the named places measurements and print zones are taken from. They are found
 * from the turn points a pattern file marks (layer 2), by the order the benchmark's pieces
 * list them, and checked against the outline. When a file is different, or the count is
 * wrong, nothing is guessed: the piece gets no landmarks and the library says so. A person can
 * then place them by hand, and those are stored on the block as overrides.
 */

export type PieceRole = "front" | "back" | "sleeve" | "collar" | "other";

export const pieceRole = (id: string): PieceRole =>
  id === "front" || id === "back" || id === "sleeve" || id === "collar" ? id : "other";

/** The landmarks each torso piece lists its turn points as, in the order the file gives them. */
const TURN_ORDER: Readonly<Record<"front" | "back", readonly LandmarkId[]>> = {
  front: ["cf-hem", "side-hem", "underarm", "shoulder-point", "hps", "cf-neck"],
  back: ["cb-neck", "hps", "shoulder-point", "underarm", "side-hem", "cb-hem"],
};

/** The landmarks every piece of a role must have for its measurements. */
const EXPECTED_LANDMARKS: Readonly<Record<PieceRole, readonly LandmarkId[]>> = {
  front: TURN_ORDER.front,
  back: TURN_ORDER.back,
  sleeve: ["underarm-a", "underarm-b", "hem-a", "hem-b", "cap-top"],
  collar: [],
  other: [],
};

export type Landmarks = PatternPiece["landmarks"];

type LandmarkResult = Readonly<{ landmarks: Landmarks; problem: string | null }>;

const SAME_PLACE_MM = 0.05;

/** Turn points, each listed once: a closed outline marks its first point again at the end. */
export function distinctPoints(points: readonly Point[]): Point[] {
  return points.filter((p, i) => points.findIndex((q) => dist(p, q) <= SAME_PLACE_MM) === i);
}

const onOutline = (outline: readonly Point[], p: Point): boolean => nearestVertex(outline, p).distance <= SAME_PLACE_MM;

const byLowerY = (a: Point, b: Point): [Point, Point] => (a[1] <= b[1] ? [a, b] : [b, a]);

/** The cap top is the outline point furthest from the underarm line, on the side away from the hem. */
function capTop(outline: readonly Point[], underarmMid: Point, hemMid: Point): Point | null {
  const axis = sub(underarmMid, hemMid);
  let best: Point | null = null;
  let bestReach = 0;
  for (const p of outline) {
    const reach = dot(sub(p, underarmMid), axis);
    if (reach > bestReach) {
      best = p;
      bestReach = reach;
    }
  }
  return best;
}

function sleeveLandmarks(outline: readonly Point[], turn: readonly Point[]): LandmarkResult {
  if (turn.length !== 4) return { landmarks: {}, problem: "The sleeve should mark four turn points: two at the underarm and two at the hem." };
  const [underarmA, underarmB] = byLowerY(turn[0], turn[1]);
  const [hemA, hemB] = byLowerY(turn[2], turn[3]);
  const top = capTop(outline, mid(underarmA, underarmB), mid(hemA, hemB));
  if (!top) return { landmarks: {}, problem: "The top of the sleeve cap could not be found." };
  return {
    landmarks: { "underarm-a": underarmA, "underarm-b": underarmB, "hem-a": hemA, "hem-b": hemB, "cap-top": top },
    problem: null,
  };
}

/** Landmarks of one piece from the turn points its file marks. */
export function detectLandmarks(id: string, outline: readonly Point[], turnPoints: readonly Point[]): LandmarkResult {
  const role = pieceRole(id);
  if (role === "collar" || role === "other") return { landmarks: {}, problem: null };
  const turn = distinctPoints(turnPoints);
  if (turn.some((p) => !onOutline(outline, p))) return { landmarks: {}, problem: "A turn point is not on the outline." };
  if (role === "sleeve") return sleeveLandmarks(outline, turn);
  const order = TURN_ORDER[role];
  if (turn.length !== order.length) {
    return { landmarks: {}, problem: `The ${role} should mark ${order.length} turn points and marks ${turn.length}.` };
  }
  return { landmarks: Object.fromEntries(order.map((landmark, i) => [landmark, turn[i]])) as Landmarks, problem: null };
}

/** Landmarks by hand replace the ones found, one at a time. */
export function withOverrides(found: Landmarks, overrides: Landmarks | undefined): Landmarks {
  return { ...found, ...(overrides ?? {}) };
}

/** Landmarks a person placed, as the library stores them: every name known, every value rounded. */
export function cleanOverrides(raw: Readonly<Record<string, Point>>): Landmarks {
  const known = new Set<string>(LANDMARK_IDS);
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([name]) => known.has(name))
      .map(([name, p]) => [name, [round2(p[0]), round2(p[1])] as Point]),
  ) as Landmarks;
}

/** Which of a role's expected landmarks the piece lacks. */
export function missingLandmarks(piece: Pick<PatternPiece, "id" | "landmarks">): LandmarkId[] {
  return EXPECTED_LANDMARKS[pieceRole(piece.id)].filter((name) => !piece.landmarks[name]);
}
