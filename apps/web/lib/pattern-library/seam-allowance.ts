import type { PatternPiece, Point, SeamAllowance } from "@/lib/production/contract";
import { offsetOutline } from "@/lib/production/geometry/offset";
import { add, dist, dot, lineMeet, round2, scale, signedArea, sub, unit } from "./geometry";
import { FOLD_SEAM, seamsOf, type Seam } from "./seams";

/**
 * Seam allowance: the extra fabric outside the sew line. A source file either holds it in its
 * cut line or does not, and a file that does not say is asked, never guessed. The sizes below are
 * Knitwright's own defaults, labelled so, until a factory gives theirs.
 */

const DEFAULT_ALLOWANCE_MM = { overlock: 6, hem: 20 } as const;

export type AllowanceChoice = Readonly<{ overlockMm: number; hemMm: number }>;

/** The question put to a person when a file does not say whether its outline holds seam allowance. */
export const OUTLINE_QUESTION =
  "Does this pattern's outline already include seam allowance? Answer net if it is the sewn size, or gross if it is the cut size.";

export type OutlineAnswer = "net" | "gross";

const HEM_SEAMS = new Set(["hem", "sleeve-hem"]);

export function allowanceMm(seamId: string, choice: AllowanceChoice): number {
  if (seamId === FOLD_SEAM) return 0;
  return HEM_SEAMS.has(seamId) ? choice.hemMm : choice.overlockMm;
}

const MITER_LIMIT = 3;

type Segment = Readonly<{ normal: Point; tangent: Point; distance: number }>;

function segmentsOf(line: readonly Point[], distances: readonly number[]): Segment[] {
  const outward = signedArea(line) > 0 ? 1 : -1;
  return line.map((p, i) => {
    const tangent = unit(sub(line[(i + 1) % line.length], p));
    return { tangent, normal: [tangent[1] * outward, -tangent[0] * outward] as Point, distance: distances[i] };
  });
}

/** The point or points that replace one vertex when each side of it is moved out by its own distance. */
function cornerPoints(v: Point, before: Segment, after: Segment): Point[] {
  const a = add(v, scale(before.normal, before.distance));
  const b = add(v, scale(after.normal, after.distance));
  if (dist(a, b) < 1e-6) return [a];
  const meet = lineMeet(a, before.tangent, b, after.tangent);
  const reach = Math.max(before.distance, after.distance) * MITER_LIMIT;
  if (meet && dist(meet, v) <= reach && dot(sub(meet, a), before.tangent) > -reach) return [meet];
  return [a, b];
}

/** Each segment of a closed line moved out by its own distance, and the corners joined. */
export function offsetEachEdge(line: readonly Point[], distances: readonly number[]): Point[] {
  const clean = line.filter((p, i) => dist(p, line[(i + 1) % line.length]) > 1e-6);
  if (clean.length !== line.length) return offsetEachEdge(clean, clean.map((_, i) => distances[Math.min(i, distances.length - 1)]));
  const segments = segmentsOf(line, distances);
  return line.flatMap((v, i) => cornerPoints(v, segments[(i - 1 + line.length) % line.length], segments[i])).map((p): Point => [round2(p[0]), round2(p[1])]);
}

/** The allowance of each segment of the line, from the seam it lies in. */
function segmentDistances(line: readonly Point[], seams: readonly Seam[], choice: AllowanceChoice): number[] | null {
  const distances = new Array<number | null>(line.length).fill(null);
  for (const seam of seams) {
    for (let i = seam.from; i !== seam.to; i = (i + 1) % line.length) distances[i] = allowanceMm(seam.seamId, choice);
    if (seam.from === seam.to) return null;
  }
  return distances.every((d): d is number => d !== null) ? distances : null;
}

const entries = (seams: readonly Seam[], choice: AllowanceChoice): SeamAllowance[] =>
  [...new Set(seams.map((s) => s.seamId))].map((seamId) => ({ seamId, mm: allowanceMm(seamId, choice), source: "knitwright-default" as const }));

type WithAllowance =
  | Readonly<{ ok: true; piece: PatternPiece; derived: string | null }>
  | Readonly<{ ok: false; question: string }>;

/**
 * A piece that holds its seam allowance, with the sew line kept. A net outline is grown by
 * the allowance of each edge; a gross one is only labelled; one the file does not describe
 * is asked about.
 */
export function withSeamAllowance(piece: PatternPiece, answer: OutlineAnswer | null, choice: AllowanceChoice = { overlockMm: DEFAULT_ALLOWANCE_MM.overlock, hemMm: DEFAULT_ALLOWANCE_MM.hem }, seams?: readonly Seam[]): WithAllowance {
  if (piece.outlineKind === "with-seam-allowance") return { ok: true, piece, derived: null };
  const kind = piece.outlineKind === "without-seam-allowance" ? "net" : answer;
  if (kind === null) return { ok: false, question: OUTLINE_QUESTION };
  const own = seams ?? seamsOf([piece]).get(piece.id) ?? [];
  if (kind === "gross") {
    const unknown = [...new Set(own.map((s) => s.seamId))].map((seamId) => ({ seamId, mm: null, source: "not-stated" as const }));
    return { ok: true, piece: { ...piece, outlineKind: "with-seam-allowance", seamAllowance: unknown }, derived: null };
  }
  const distances = segmentDistances(piece.cutOutline, own, choice);
  const grown = distances ? offsetEachEdge(piece.cutOutline, distances) : offsetOutline(piece.cutOutline, choice.overlockMm, "miter").map((p): Point => [round2(p[0]), round2(p[1])]);
  const allowance = distances ? entries(own, choice) : [{ seamId: "all-edges", mm: choice.overlockMm, source: "knitwright-default" as const }];
  return {
    ok: true,
    piece: { ...piece, sewLine: piece.cutOutline, cutOutline: grown, outlineKind: "with-seam-allowance", seamAllowance: allowance },
    derived: `${piece.name}: seam allowance added, ${choice.overlockMm} mm at seams and ${choice.hemMm} mm at hems (Knitwright default, not from your factory).`,
  };
}
