import type { Pt } from "./geometry";

/**
 * Whether a closed outline is a valid panel (spec F-S3 acceptance): at least three distinct
 * points, every number finite, an area, and no two edges that do not share a corner touching.
 */

const orient = (a: Pt, b: Pt, c: Pt): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const onSegment = (a: Pt, b: Pt, p: Pt): boolean =>
  Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);

/** True when segments ab and cd share at least one point. */
export function segmentsTouch(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (o1 === 0 && onSegment(a, b, c)) || (o2 === 0 && onSegment(a, b, d)) || (o3 === 0 && onSegment(c, d, a)) || (o4 === 0 && onSegment(c, d, b));
}

/** Signed area by the shoelace formula; the sign gives the winding. */
export function signedArea(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Index pairs of edges that cross or touch, other than neighbours at their shared corner. */
export function selfIntersections(pts: readonly Pt[]): [number, number][] {
  const n = pts.length;
  const found: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsTouch(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) found.push([i, j]);
    }
  }
  return found;
}

export type OutlineProblem = "too-few-points" | "not-finite" | "no-area" | "repeated-point" | "self-intersecting";

/** Every problem with a closed outline; an empty list is a valid panel. */
export function outlineProblems(pts: readonly Pt[]): OutlineProblem[] {
  if (pts.length < 3) return ["too-few-points"];
  if (!pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))) return ["not-finite"];
  const problems: OutlineProblem[] = [];
  if (pts.some((p, i) => { const q = pts[(i + 1) % pts.length]; return p[0] === q[0] && p[1] === q[1]; })) problems.push("repeated-point");
  if (Math.abs(signedArea(pts)) < 1) problems.push("no-area");
  if (selfIntersections(pts).length > 0) problems.push("self-intersecting");
  return problems;
}
