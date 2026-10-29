/**
 * The drawing helpers of `docs/spec/articles/JSY-SS-01/tools/draft-pattern.ps1`, ported one for one.
 * Every sum is written in the same order as the script so the same input gives the same doubles,
 * and so the same file bytes. Coordinates are millimetres, x to the right, y DOWN (screen frame).
 */

export type Pt = readonly [number, number];
export type Polyline = readonly Pt[];

/** A cubic Bezier sampled at n + 1 evenly spaced parameter values (the script's `Bez`). */
export function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 60): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    pts.push([x, y]);
  }
  return pts;
}

export const line = (a: Pt, b: Pt): Pt[] => [a, b];
export const rev = (pts: Polyline): Pt[] => [...pts].reverse();
/** Mirror across the centre line x = 0. */
export const mir = (pts: Polyline): Pt[] => pts.map((p): Pt => [-p[0], p[1]]);

/** Length of a polyline. */
export function len(pts: Polyline): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    s += Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
  }
  return s;
}

export function unit(dx: number, dy: number): Pt {
  const l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-9) return [0, 0];
  return [dx / l, dy / l];
}

/** The point and the direction of travel at an arc length along a polyline (the script's `At`). */
export function at(pts: Polyline, dist: number): { p: Pt; d: Pt } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const l = Math.sqrt(dx * dx + dy * dy);
    if (acc + l >= dist && l > 0) {
      const t = (dist - acc) / l;
      return { p: [pts[i - 1][0] + dx * t, pts[i - 1][1] + dy * t], d: unit(dx, dy) };
    }
    acc += l;
  }
  const n = pts.length;
  return { p: pts[n - 1], d: unit(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]) };
}

/** One edge run of a closed outline and the seam allowance that applies along it. */
export type Segment = Readonly<{ pts: Polyline; sa: number; seamId: string }>;

/**
 * The closed sew line from its segments, each segment's last point dropped because the next one
 * starts there. `allow[i]` is the allowance on the edge from point i to point i + 1.
 */
export function outline(segs: readonly Segment[]): { points: Pt[]; allow: number[]; seam: string[] } {
  const points: Pt[] = [];
  const allow: number[] = [];
  const seam: string[] = [];
  for (const seg of segs) {
    for (let i = 0; i < seg.pts.length - 1; i++) {
      points.push(seg.pts[i]);
      allow.push(seg.sa);
      seam.push(seg.seamId);
    }
  }
  return { points, allow, seam };
}

function offsetCorner(a: Pt, b: Pt, c: Pt, s1: number, s2: number): Pt {
  const d1 = unit(b[0] - a[0], b[1] - a[1]);
  const d2 = unit(c[0] - b[0], c[1] - b[1]);
  const n1: Pt = [d1[1], -d1[0]];
  const n2: Pt = [d2[1], -d2[0]];
  const p1: Pt = [a[0] + n1[0] * s1, a[1] + n1[1] * s1];
  const p2: Pt = [b[0] + n2[0] * s2, b[1] + n2[1] * s2];
  const cross = d1[0] * d2[1] - d1[1] * d2[0];
  const fallback: Pt = [b[0] + n2[0] * s2, b[1] + n2[1] * s2];
  if (Math.abs(cross) < 1e-3) return fallback;
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / cross;
  const q: Pt = [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
  const dist = Math.sqrt(Math.pow(q[0] - b[0], 2) + Math.pow(q[1] - b[1], 2));
  return dist > 3 * Math.max(s1, s2) ? fallback : q;
}

/** The cut line: every edge moved outward by its own allowance, corners mitred (the script's `OffsetOutline`). */
export function offsetOutline(points: Polyline, allow: readonly number[]): Pt[] {
  const n = points.length;
  return points.map((b, i) =>
    offsetCorner(points[(i - 1 + n) % n], b, points[(i + 1) % n], allow[(i - 1 + n) % n], allow[i]),
  );
}

/** A notch: a 5 mm slit cut in from the cut line, at an arc length along a curve drawn in sewing order. */
export function notch(curve: Polyline, dist: number, allow: number): [Pt, Pt] {
  const r = at(curve, dist);
  const nx = r.d[1];
  const ny = -r.d[0];
  const cut: Pt = [r.p[0] + nx * allow, r.p[1] + ny * allow];
  return [cut, [cut[0] - nx * 5, cut[1] - ny * 5]];
}

export type Box = Readonly<{ x0: number; x1: number; y0: number; y1: number }>;

export function bbox(pts: Polyline): Box {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
