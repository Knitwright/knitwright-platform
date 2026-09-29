import type { PathCommand, Point } from "./model";

/**
 * A chain is a run of connected pieces that starts at a point: each piece is a straight
 * line or a cubic curve. Chains are plain data, so flipping, reversing and joining them
 * makes new chains and never changes the ones given.
 */
export interface Piece {
  readonly c1?: Point;
  readonly c2?: Point;
  readonly to: Point;
}

export interface Chain {
  readonly start: Point;
  readonly pieces: readonly Piece[];
}

export const pt = (x: number, y: number): Point => ({ x, y });

export const chain = (start: Point, ...pieces: readonly Piece[]): Chain => ({ start, pieces });

export const lineTo = (to: Point): Piece => ({ to });

export const curveTo = (c1: Point, c2: Point, to: Point): Piece => ({ c1, c2, to });

export const endOf = (item: Chain): Point => item.pieces.at(-1)?.to ?? item.start;

const withPoints = (item: Chain, change: (point: Point) => Point): Chain => ({
  start: change(item.start),
  pieces: item.pieces.map((piece) => ({
    ...(piece.c1 && piece.c2 ? { c1: change(piece.c1), c2: change(piece.c2) } : {}),
    to: change(piece.to),
  })),
});

/** The mirror image about the centre line x = 0. */
export const mirrorChain = (item: Chain): Chain => withPoints(item, (point) => pt(-point.x, point.y));

/** Moves every point by the same amount. */
export const shiftChain = (item: Chain, dx: number, dy: number): Chain =>
  withPoints(item, (point) => pt(point.x + dx, point.y + dy));

/** The same shape drawn the other way round, from its end to its start. */
export function reverseChain(item: Chain): Chain {
  const points = [item.start, ...item.pieces.map((piece) => piece.to)];
  const pieces = item.pieces.map((piece, index) => {
    const to = points[index] as Point;
    return piece.c1 && piece.c2 ? curveTo(piece.c2, piece.c1, to) : lineTo(to);
  });
  return { start: endOf(item), pieces: pieces.reverse() };
}

/** Joins chains end to start. A gap between them is closed with a straight line. */
export function joinChains(first: Chain, ...rest: readonly Chain[]): Chain {
  return rest.reduce<Chain>((joined, next) => {
    const end = endOf(joined);
    const gap = end.x === next.start.x && end.y === next.start.y ? [] : [lineTo(next.start)];
    return { start: joined.start, pieces: [...joined.pieces, ...gap, ...next.pieces] };
  }, first);
}

function commandsOf(item: Chain): PathCommand[] {
  return item.pieces.map((piece) =>
    piece.c1 && piece.c2 ? { op: "C", c1: piece.c1, c2: piece.c2, to: piece.to } : { op: "L", to: piece.to },
  );
}

/** Commands for an open line. */
export const openCommands = (item: Chain): readonly PathCommand[] => [{ op: "M", to: item.start }, ...commandsOf(item)];

/** Commands for a closed shape: one or more chains, each closed on its own. */
export const closedCommands = (...items: readonly Chain[]): readonly PathCommand[] =>
  items.flatMap((item) => [...openCommands(item), { op: "Z" } as const]);

const KAPPA = 0.5522847498;

/** A quarter of an ellipse from (a, 0) round to (0, b), about the origin, as one curve. */
export const quarterDown = (a: number, b: number): Piece =>
  curveTo(pt(a, b * KAPPA), pt(a * KAPPA, b), pt(0, b));

/** A circle as four curves, ending where it began. */
export function circle(centre: Point, radius: number): Chain {
  const k = radius * KAPPA;
  const { x, y } = centre;
  return chain(
    pt(x + radius, y),
    curveTo(pt(x + radius, y + k), pt(x + k, y + radius), pt(x, y + radius)),
    curveTo(pt(x - k, y + radius), pt(x - radius, y + k), pt(x - radius, y)),
    curveTo(pt(x - radius, y - k), pt(x - k, y - radius), pt(x, y - radius)),
    curveTo(pt(x + k, y - radius), pt(x + radius, y - k), pt(x + radius, y)),
  );
}

/** Rounds to a tenth of a drawing unit, so output is steady and small. Never minus zero. */
export const tidy = (value: number): number => Math.round(value * 10) / 10 + 0;

const between = (a: Point, b: Point, t: number): Point => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

/** The part of one piece from a share `t` of the way along it to its end. The curve itself is unchanged. */
export function tailOfCubic(start: Point, piece: Piece, t: number): Chain {
  if (!piece.c1 || !piece.c2) return { start: between(start, piece.to, t), pieces: [piece] };
  const ab = between(start, piece.c1, t);
  const bc = between(piece.c1, piece.c2, t);
  const cd = between(piece.c2, piece.to, t);
  const abc = between(ab, bc, t);
  const bcd = between(bc, cd, t);
  const at = between(abc, bcd, t);
  return { start: at, pieces: [curveTo(bcd, cd, piece.to)] };
}
