import type { Pt } from "./geometry";
import { segmentsTouch } from "./validate";

/**
 * Offsetting a tight curve outward can leave a tiny loop where two neighbouring corners overshoot
 * each other (the reference script leaves one of about 0.1 mm at each underarm of the XS back).
 * A cutter cannot follow a loop, so it is cut off at the crossing. Only loops spanning a few
 * edges are trimmed; a larger crossing is a real fault and is left for validation to report.
 */
export const MAX_LOOP_EDGES = 8;

function crossing(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r: Pt = [b[0] - a[0], b[1] - a[1]];
  const s: Pt = [d[0] - c[0], d[1] - c[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (denom === 0) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denom;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

function firstLoop(pts: readonly Pt[]): { i: number; j: number; at: Pt } | null {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j <= Math.min(i + MAX_LOOP_EDGES, n - 1); j++) {
      if (i === 0 && j === n - 1) continue;
      const [a, b, c, d] = [pts[i], pts[i + 1], pts[j], pts[(j + 1) % n]];
      if (!segmentsTouch(a, b, c, d)) continue;
      const at = crossing(a, b, c, d);
      if (at) return { i, j, at };
    }
  }
  return null;
}

/** The closed outline with every small loop cut off at its crossing point. */
export function trimLoops(points: readonly Pt[]): Pt[] {
  let pts = [...points];
  for (let loop = firstLoop(pts); loop; loop = firstLoop(pts)) {
    pts = [...pts.slice(0, loop.i + 1), loop.at, ...pts.slice(loop.j + 1)];
  }
  return pts;
}
