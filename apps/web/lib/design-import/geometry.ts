/** Points and the small amount of linear algebra the picture reading needs. Pure; no pixels here. */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** A box in pixels, or in 0 to 1 of the picture where a name says so. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Pair {
  readonly from: Pt;
  readonly to: Pt;
}

/** A 3 x 3 matrix, row by row. An affine map has [0, 0, 1] in its last row. */
export interface Transform {
  readonly kind: "affine" | "homography";
  readonly m: readonly number[];
}

/** Solves A x = b by Gaussian elimination with pivoting. Null when the system has no single answer. */
export function solveLinear(a: readonly (readonly number[])[], b: readonly number[]): number[] | null {
  const n = b.length;
  const rows = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    if (Math.abs(rows[pivot][col]) < 1e-9) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let r = col + 1; r < n; r += 1) {
      const factor = rows[r][col] / rows[col][col];
      for (let c = col; c <= n; c += 1) rows[r][c] -= factor * rows[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = rows[r][n];
    for (let c = r + 1; c < n; c += 1) sum -= rows[r][c] * x[c];
    x[r] = sum / rows[r][r];
  }
  return x;
}

/** Least squares: the x that makes A x closest to b, through the normal equations. */
function leastSquares(a: readonly (readonly number[])[], b: readonly number[]): number[] | null {
  const n = a[0].length;
  const ata = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => a.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const atb = Array.from({ length: n }, (_, i) => a.reduce((sum, row, r) => sum + row[i] * b[r], 0));
  return solveLinear(ata, atb);
}

/**
 * The map that takes each `from` to its `to`. An affine map needs three pairs that are not on one line;
 * a homography (a flat seen at an angle) needs four. More pairs are fitted by least squares. Null when
 * the pairs cannot decide one map.
 */
export function fitTransform(pairs: readonly Pair[], kind: Transform["kind"]): Transform | null {
  if (pairs.length < (kind === "affine" ? 3 : 4)) return null;
  if (kind === "affine") {
    const rows = pairs.map(({ from }) => [from.x, from.y, 1]);
    const ax = leastSquares(rows, pairs.map((p) => p.to.x));
    const ay = leastSquares(rows, pairs.map((p) => p.to.y));
    return ax && ay ? { kind, m: [...ax, ...ay, 0, 0, 1] } : null;
  }
  const rows: number[][] = [];
  const target: number[] = [];
  for (const { from, to } of pairs) {
    rows.push([from.x, from.y, 1, 0, 0, 0, -from.x * to.x, -from.y * to.x]);
    target.push(to.x);
    rows.push([0, 0, 0, from.x, from.y, 1, -from.x * to.y, -from.y * to.y]);
    target.push(to.y);
  }
  const h = leastSquares(rows, target);
  return h ? { kind, m: [...h, 1] } : null;
}

export function applyTransform(transform: Transform, p: Pt): Pt {
  const m = transform.m;
  const w = m[6] * p.x + m[7] * p.y + m[8];
  // A point sent to infinity has no place on the flat. It stays where it was.
  if (Math.abs(w) < 1e-12) return { x: p.x, y: p.y };
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w };
}

/** The root mean square distance between where the pairs went and where they should have. */
export function rmsError(pairs: readonly Pair[], transform: Transform): number {
  if (pairs.length === 0) return 0;
  const sum = pairs.reduce((total, { from, to }) => {
    const at = applyTransform(transform, from);
    return total + (at.x - to.x) ** 2 + (at.y - to.y) ** 2;
  }, 0);
  return Math.sqrt(sum / pairs.length);
}

/** The area of a closed polygon, always positive. */
export function polygonArea(points: readonly Pt[]): number {
  let twice = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
}

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function simplifyOpen(points: readonly Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  let worst = -1;
  let at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = distanceToSegment(points[i], first, last);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tolerance) return [first, last];
  return [...simplifyOpen(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplifyOpen(points.slice(at), tolerance)];
}

/** Douglas-Peucker on a closed outline, split at its two farthest-apart points so no corner is the seam. */
export function simplifyClosed(points: readonly Pt[], tolerance: number): Pt[] {
  if (points.length <= 4) return [...points];
  let start = 0;
  points.forEach((p, i) => {
    if (p.x + p.y < points[start].x + points[start].y) start = i;
  });
  let far = start;
  let best = -1;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - points[start].x, p.y - points[start].y);
    if (d > best) {
      best = d;
      far = i;
    }
  });
  const rotated = [...points.slice(start), ...points.slice(0, start)];
  const split = (far - start + points.length) % points.length;
  const left = simplifyOpen(rotated.slice(0, split + 1), tolerance);
  const right = simplifyOpen([...rotated.slice(split), rotated[0]], tolerance);
  return [...left.slice(0, -1), ...right.slice(0, -1)];
}
