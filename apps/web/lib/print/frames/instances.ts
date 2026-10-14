import type { ViewId } from "@/lib/artwork-stack";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { reflectionAcross, applyAll, type Affine, type Pt } from "../geometry/affine";
import { mergeRings } from "../geometry/clip";
import type { Ring } from "../scene";

/**
 * Which views a piece of the pattern is printed for. A sleeve is one piece cut as a pair, so it is printed once for
 * each sleeve view, the right one as its mirror image. A pattern whose piece ids differ passes its own table.
 */
export type PieceRoles = Readonly<Record<string, readonly ViewId[]>>;

export const DEFAULT_PIECE_ROLES: PieceRoles = {
  front: ["front"],
  back: ["back"],
  sleeve: ["sleeve-left", "sleeve-right"],
  collar: ["collar"],
};

/** One thing that is printed: a piece as it lies for one view, opened out when it is cut on the fold. */
export interface PieceInstance {
  /** The view's name: front, back, sleeve-left, sleeve-right or collar. */
  readonly id: ViewId;
  readonly view: ViewId;
  readonly size: string;
  /** The piece as printed. A right sleeve is the mirror image of the piece in the file. */
  readonly piece: PatternPiece;
  readonly pieceName: string;
  readonly mirrored: boolean;
  /** The whole cut shape: both halves of a piece cut on the fold. */
  readonly opened: Ring;
}

const toPoint = ([x, y]: Pt): Point => [x, y];

/** The same piece with every point moved by a transform. Notches, lines and landmarks move with the outline. */
export function transformPiece(piece: PatternPiece, matrix: Affine): PatternPiece {
  const move = (points: readonly Pt[]): Point[] => applyAll(matrix, points).map(toPoint);
  const line = (l: PatternPiece["grainLine"]): PatternPiece["grainLine"] =>
    l === null ? null : { from: toPoint(applyAll(matrix, [l.from])[0] as Pt), to: toPoint(applyAll(matrix, [l.to])[0] as Pt) };
  const landmarks: PatternPiece["landmarks"] = Object.fromEntries(
    Object.entries(piece.landmarks).map(([name, at]) => [name, move([at as Pt])[0]]),
  );
  return {
    ...piece,
    cutOutline: move(piece.cutOutline),
    sewLine: piece.sewLine === null ? null : move(piece.sewLine),
    notches: piece.notches.map((n) => ({ ...n, at: move([n.at])[0] as Point })),
    grainLine: line(piece.grainLine),
    foldLine: line(piece.foldLine),
    internalLines: piece.internalLines.map(move),
    landmarks,
  };
}

/** The shape of a piece cut on the fold, with its mirror image joined along the fold line. Other pieces are as they are. */
export function openOutline(piece: PatternPiece): Ring {
  if (!piece.onFold || piece.foldLine === null) return piece.cutOutline;
  const { from, to } = piece.foldLine;
  const mirror = reflectionAcross(from, [to[0] - from[0], to[1] - from[1]]);
  const merged = mergeRings([piece.cutOutline, applyAll(mirror, piece.cutOutline)]);
  // Two halves that touch along the fold make one ring. If they do not, the longest is the best reading of the piece.
  return merged.reduce<Ring>((best, ring) => (ring.length > best.length ? ring : best), piece.cutOutline);
}

/** The line a sleeve is mirrored about: through the middle of the hem, square to it. */
function sleeveMirror(piece: PatternPiece): Affine | null {
  const a = piece.landmarks["hem-a"];
  const b = piece.landmarks["hem-b"];
  if (!a || !b) return null;
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return reflectionAcross(mid, [-(b[1] - a[1]), b[0] - a[0]]);
}

export interface InstanceSet {
  readonly instances: readonly PieceInstance[];
  /** Piece names the roles table does not place on any view; they are not printed. */
  readonly unplaced: readonly string[];
}

/** The things to print for one size of a pattern. */
export function instancesOf(pieces: readonly PatternPiece[], size: string, roles: PieceRoles = DEFAULT_PIECE_ROLES): InstanceSet {
  const instances: PieceInstance[] = [];
  const unplaced: string[] = [];
  for (const piece of pieces) {
    const views = roles[piece.id];
    if (!views) {
      unplaced.push(piece.name);
      continue;
    }
    views.forEach((view, at) => {
      const mirror = piece.mirroredPair && at === 1 ? sleeveMirror(piece) : null;
      const shown = mirror ? transformPiece(piece, mirror) : piece;
      instances.push({ id: view, view, size, piece: shown, pieceName: mirror ? `${piece.name} (right)` : piece.mirroredPair && views.length > 1 ? `${piece.name} (left)` : piece.name, mirrored: mirror !== null, opened: openOutline(shown) });
    });
  }
  return { instances, unplaced };
}
