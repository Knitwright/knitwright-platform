import type { LandmarkId, PatternPiece, Point } from "@/lib/production/contract";
import { dist, nearestVertex, runLength, slice } from "./geometry";
import { pieceRole, type PieceRole } from "./landmarks";

/**
 * The seams of a piece: the stretches of its line between two landmarks, each with the name
 * its partner on the next piece shares. Everything is read from the line a person would sew
 * to, which is the sew line when the file has one and the cut outline when it does not.
 */

export type Seam = Readonly<{
  seamId: string;
  pieceId: string;
  from: number;
  to: number;
  points: readonly Point[];
  lengthMm: number;
}>;

export const FOLD_SEAM = "fold";

/** The line measurements and seams are read from. */
export const workLine = (piece: Pick<PatternPiece, "cutOutline" | "sewLine">): readonly Point[] => piece.sewLine ?? piece.cutOutline;

/** A landmark is on the line when a vertex sits within this distance of it. */
const ON_LINE_MM = 0.5;

const key = (a: string, b: string): string => [a, b].sort().join("|");

const TORSO_EDGES: Readonly<Record<"front" | "back", Readonly<Record<string, string>>>> = {
  front: {
    [key("cf-hem", "side-hem")]: "hem",
    [key("side-hem", "underarm")]: "side-seam",
    [key("underarm", "shoulder-point")]: "armhole-front",
    [key("shoulder-point", "hps")]: "shoulder",
    [key("hps", "cf-neck")]: "neckline-front",
    [key("cf-neck", "cf-hem")]: FOLD_SEAM,
  },
  back: {
    [key("cb-neck", "hps")]: "neckline-back",
    [key("hps", "shoulder-point")]: "shoulder",
    [key("shoulder-point", "underarm")]: "armhole-back",
    [key("underarm", "side-hem")]: "side-seam",
    [key("side-hem", "cb-hem")]: "hem",
    [key("cb-hem", "cb-neck")]: FOLD_SEAM,
  },
};

/** The index of the vertex of `line` each landmark sits on. A landmark off the line is left out. */
export function landmarkIndices(line: readonly Point[], landmarks: PatternPiece["landmarks"]): Map<LandmarkId, number> {
  const found = new Map<LandmarkId, number>();
  for (const [name, point] of Object.entries(landmarks) as [LandmarkId, Point][]) {
    const nearest = nearestVertex(line, point);
    if (nearest.distance <= ON_LINE_MM) found.set(name, nearest.index);
  }
  return found;
}

function seamBetween(pieceId: string, line: readonly Point[], seamId: string, from: number, to: number): Seam {
  const points = slice(line, from, to);
  return { seamId, pieceId, from, to, points, lengthMm: runLength(points) };
}

/** True when going forward from one vertex to another passes any of the others. */
const passes = (n: number, from: number, to: number, others: readonly number[]): boolean =>
  others.some((other) => other !== from && other !== to && (other - from + n) % n < (to - from + n) % n);

/**
 * The seam between two landmarks that has no other landmark on it, whichever way round the
 * outline is drawn. The points always run from `from` to `to`.
 */
function arcBetween(pieceId: string, line: readonly Point[], seamId: string, from: number, to: number, others: readonly number[]): Seam {
  if (!passes(line.length, from, to, others)) return seamBetween(pieceId, line, seamId, from, to);
  const back = seamBetween(pieceId, line, seamId, to, from);
  return { ...back, from, to, points: [...back.points].reverse() };
}

function torsoSeams(piece: PatternPiece, role: "front" | "back"): Seam[] {
  const line = workLine(piece);
  const indices = landmarkIndices(line, piece.landmarks);
  const marks = [...indices.entries()].sort((a, b) => a[1] - b[1]);
  const seams: Seam[] = [];
  marks.forEach(([name, at], i) => {
    const [next, nextAt] = marks[(i + 1) % marks.length];
    const seamId = TORSO_EDGES[role][key(name, next)];
    if (seamId && marks.length > 1) seams.push(seamBetween(piece.id, line, seamId, at, nextAt));
  });
  return seams;
}

/**
 * A sleeve's two cap halves join the front and the back armhole. The file does not say which
 * half is the front, so the half whose length is nearer the front armhole is taken as the
 * front. Without both armholes the halves keep neutral names.
 */
function sleeveSeams(piece: PatternPiece, armholes: Armholes | null): Seam[] {
  const line = workLine(piece);
  const at = landmarkIndices(line, piece.landmarks);
  const need = ["underarm-a", "underarm-b", "hem-a", "hem-b", "cap-top"] as const;
  if (need.some((name) => !at.has(name))) return [];
  const idx = (name: (typeof need)[number]): number => at.get(name) as number;
  const marks = need.map(idx);
  const arc = (id: string, from: (typeof need)[number], to: (typeof need)[number]): Seam => arcBetween(piece.id, line, id, idx(from), idx(to), marks);
  const halfA = arc("sleeve-cap-a", "cap-top", "underarm-a");
  const halfB = arc("sleeve-cap-b", "underarm-b", "cap-top");
  const swapped = armholes ? Math.abs(halfA.lengthMm - armholes.back) + Math.abs(halfB.lengthMm - armholes.front) : 0;
  const straight = armholes ? Math.abs(halfA.lengthMm - armholes.front) + Math.abs(halfB.lengthMm - armholes.back) : 0;
  const named = (half: Seam, id: string): Seam => ({ ...half, seamId: id });
  const caps = !armholes ? [halfA, halfB] : straight <= swapped
    ? [named(halfA, "armhole-front"), named(halfB, "armhole-back")]
    : [named(halfA, "armhole-back"), named(halfB, "armhole-front")];
  return [
    ...caps,
    arc("sleeve-underarm", "underarm-a", "hem-a"),
    arc("sleeve-hem", "hem-a", "hem-b"),
    arc("sleeve-underarm", "hem-b", "underarm-b"),
  ];
}

const NEAR_FOLD_MM = 0.05;

/** A collar is a rectangle cut on the fold: its long edges join the neckline, the end at the fold is not sewn. */
function collarSeams(piece: PatternPiece): Seam[] {
  const line = workLine(piece);
  if (line.length !== 4) return [];
  const fold = piece.foldLine;
  const onFold = (p: Point): boolean => {
    if (!fold) return false;
    const length = dist(fold.from, fold.to) || 1;
    const area = Math.abs((fold.to[0] - fold.from[0]) * (fold.from[1] - p[1]) - (fold.from[0] - p[0]) * (fold.to[1] - fold.from[1]));
    return area / length <= NEAR_FOLD_MM;
  };
  const edges = line.map((_, i) => ({ i, length: dist(line[i], line[(i + 1) % 4]) }));
  const longest = new Set([...edges].sort((a, b) => b.length - a.length).slice(0, 2).map((e) => e.i));
  return edges.map((edge) => {
    const a = line[edge.i];
    const b = line[(edge.i + 1) % 4];
    const id = longest.has(edge.i) ? "collar-neckline" : onFold(a) && onFold(b) ? FOLD_SEAM : "collar-join";
    return seamBetween(piece.id, line, id, edge.i, (edge.i + 1) % 4);
  });
}

type Armholes = Readonly<{ front: number; back: number }>;

/** Lengths of the front and back armholes, when both pieces have them. */
export function armholeLengths(pieces: readonly PatternPiece[]): Armholes | null {
  const length = (role: PieceRole, seamId: string): number | null => {
    const piece = pieces.find((p) => pieceRole(p.id) === role);
    if (!piece || (role !== "front" && role !== "back")) return null;
    return torsoSeams(piece, role).find((s) => s.seamId === seamId)?.lengthMm ?? null;
  };
  const front = length("front", "armhole-front");
  const back = length("back", "armhole-back");
  return front !== null && back !== null ? { front, back } : null;
}

/** The seams of every piece in one size. */
export function seamsOf(pieces: readonly PatternPiece[]): ReadonlyMap<string, readonly Seam[]> {
  const armholes = armholeLengths(pieces);
  const result = new Map<string, readonly Seam[]>();
  for (const piece of pieces) {
    const role = pieceRole(piece.id);
    if (role === "front" || role === "back") result.set(piece.id, torsoSeams(piece, role));
    else if (role === "sleeve") result.set(piece.id, sleeveSeams(piece, armholes));
    else if (role === "collar") result.set(piece.id, collarSeams(piece));
    else result.set(piece.id, []);
  }
  return result;
}
