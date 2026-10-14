/**
 * A 2D affine transform as the six numbers of an SVG matrix: x' = a*x + c*y + e, y' = b*x + d*y + f.
 * All values are plain numbers, never mutated: every function returns a new transform.
 */
export type Affine = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export type Pt = readonly [number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export const translation = (dx: number, dy: number): Affine => [1, 0, 0, 1, dx, dy];

/** Turns counter-clockwise by `radians` in a y-up plane. */
export const rotation = (radians: number): Affine => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
};

export const scaling = (sx: number, sy: number): Affine => [sx, 0, 0, sy, 0, 0];

/** `first` is applied before `second`. */
export function compose(second: Affine, first: Affine): Affine {
  const [a2, b2, c2, d2, e2, f2] = second;
  const [a1, b1, c1, d1, e1, f1] = first;
  return [
    a2 * a1 + c2 * b1,
    b2 * a1 + d2 * b1,
    a2 * c1 + c2 * d1,
    b2 * c1 + d2 * d1,
    a2 * e1 + c2 * f1 + e2,
    b2 * e1 + d2 * f1 + f2,
  ];
}

export const determinant = ([a, b, c, d]: Affine): number => a * d - b * c;

export function invert(matrix: Affine): Affine {
  const det = determinant(matrix);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new RangeError("This transform cannot be undone.");
  const [a, b, c, d, e, f] = matrix;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export const apply = ([a, b, c, d, e, f]: Affine, [x, y]: Pt): Pt => [a * x + c * y + e, b * x + d * y + f];

export const applyAll = (matrix: Affine, points: readonly Pt[]): Pt[] => points.map((point) => apply(matrix, point));

/** Reflection across the line through `origin` with direction `direction`. */
export function reflectionAcross(origin: Pt, direction: Pt): Affine {
  const length = Math.hypot(direction[0], direction[1]);
  if (length === 0) throw new RangeError("A mirror line needs a direction.");
  const ux = direction[0] / length;
  const uy = direction[1] / length;
  const linear: Affine = [2 * ux * ux - 1, 2 * ux * uy, 2 * ux * uy, 2 * uy * uy - 1, 0, 0];
  return compose(translation(origin[0], origin[1]), compose(linear, translation(-origin[0], -origin[1])));
}
