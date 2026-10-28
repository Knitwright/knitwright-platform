import type { Notch, PatternPiece, Point } from "@/lib/production/contract";
import { nearestPointOnOutline, pointAlong, round2, runLength } from "./geometry";
import { pieceRole } from "./landmarks";
import { FOLD_SEAM, seamsOf, type Seam } from "./seams";
import { foldFrame } from "./measure/frame";

/**
 * Notches are the small cuts a sewer matches: one on the front, two on the back, and the
 * shoulder positions on the collar. They are placed at the same share of the way along both
 * sides of a seam, so a sleeve cap that is a little longer than its armhole is matched evenly.
 */

const NOTCH_AT = 0.5;

/** Seams that carry a notch on every piece they join. */
export const NOTCHED_SEAMS: ReadonlySet<string> = new Set([
  "shoulder", "side-seam", "armhole-front", "armhole-back", "neckline-front", "neckline-back",
  "sleeve-underarm", "sleeve-cap-a", "sleeve-cap-b", "collar-neckline",
]);

const COUNT_BY_SEAM: Readonly<Record<string, number>> = { "armhole-back": 2 };

function countFor(pieceId: string, seamId: string): number {
  const role = pieceRole(pieceId);
  if (role === "back") return 2;
  if (role === "sleeve") return COUNT_BY_SEAM[seamId] ?? 1;
  return 1;
}

/** The mark lies on the cut line: when there is a sew line the mark is carried out to it. */
function onCutLine(piece: PatternPiece, at: Point): Point {
  if (!piece.sewLine) return at;
  return nearestPointOnOutline(piece.cutOutline, at).point;
}

const place = (piece: PatternPiece, seam: Seam, share: number): Notch => ({
  seamId: seam.seamId,
  at: ((p): Point => [round2(p[0]), round2(p[1])])(onCutLine(piece, pointAlong(seam.points, seam.lengthMm * share))),
  count: countFor(piece.id, seam.seamId),
});

/** The shoulder marks on a collar: where the shoulder seams fall, scaled from the necklines to the collar's length. */
function collarNotches(collar: PatternPiece, seams: readonly Seam[], necklines: { front: number; back: number } | null): Notch[] {
  const frame = foldFrame(collar);
  const edges = seams.filter((s) => s.seamId === "collar-neckline");
  if (!frame || !necklines || edges.length === 0) return [];
  return edges.map((edge) => {
    const run = frame.across(edge.points[0]) <= frame.across(edge.points.at(-1) as Point) ? edge.points : [...edge.points].reverse();
    const share = necklines.back / (necklines.front + necklines.back);
    return { seamId: "collar-neckline", at: ((p): Point => [round2(p[0]), round2(p[1])])(onCutLine(collar, pointAlong(run, runLength(run) * share))), count: 1 };
  });
}

function necklinesOf(pieces: readonly PatternPiece[], seams: ReadonlyMap<string, readonly Seam[]>): { front: number; back: number } | null {
  const find = (id: string, seamId: string): number | undefined => seams.get(id)?.find((s) => s.seamId === seamId)?.lengthMm;
  const [front, back] = [find("front", "neckline-front"), find("back", "neckline-back")];
  return pieces.length > 0 && front !== undefined && back !== undefined ? { front, back } : null;
}

type Notched = Readonly<{ pieces: readonly PatternPiece[]; derived: string[] }>;

/**
 * Notches for the pieces of one size. A piece that already has notches in its file keeps them
 * untouched; only pieces without any are given Knitwright's, and each says so in `derived`.
 */
export function addNotches(pieces: readonly PatternPiece[]): Notched {
  const seams = seamsOf(pieces);
  const necklines = necklinesOf(pieces, seams);
  const derived: string[] = [];
  const result = pieces.map((piece) => {
    if (piece.notches.length > 0) return piece;
    const own = seams.get(piece.id) ?? [];
    const notches = pieceRole(piece.id) === "collar"
      ? collarNotches(piece, own, necklines)
      : own.filter((s) => NOTCHED_SEAMS.has(s.seamId) && s.seamId !== FOLD_SEAM).map((s) => place(piece, s, NOTCH_AT));
    if (notches.length === 0) return piece;
    derived.push(`${piece.name}: ${notches.length} notches added by Knitwright, at the middle of each seam (the shoulder positions on the collar).`);
    return { ...piece, notches };
  });
  return { pieces: result, derived: [...new Set(derived)] };
}

/** How far a notch lies from the cut line it should be on, in millimetres. */
export const notchOffLine = (piece: PatternPiece, notch: Notch): number => nearestPointOnOutline(piece.cutOutline, notch.at).distance;
