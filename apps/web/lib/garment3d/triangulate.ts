import Delaunator from "delaunator";
import { distanceToPolyline, type Polyline } from "@/lib/flat/geometry";
import type { Point } from "@/lib/flat/model";

/** Three indices into `points`. */
export type Triangle = readonly [number, number, number];

export interface Region {
  readonly points: readonly Point[];
  /**
   * Every triangle turns the same way: its area, worked out as
   * ((b - a) × (c - a)) / 2 in the drawing's axes (x right, y down), is above zero.
   */
  readonly triangles: readonly Triangle[];
}

/** Points along a line, with the corners kept and no step longer than `spacing`. */
export function resample(points: readonly Point[], spacing: number, closed: boolean): Point[] {
  const first = points[0];
  if (!first) return [];
  const path = closed ? [...points, first] : points;
  const out: Point[] = [first];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1] as Point;
    const b = path[i] as Point;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing));
    for (let step = 1; step <= steps; step += 1) out.push({ x: a.x + ((b.x - a.x) * step) / steps, y: a.y + ((b.y - a.y) * step) / steps });
  }
  return closed ? out.slice(0, -1) : out;
}

/** The signed area of a closed outline. */
export function polygonArea(loop: readonly Point[]): number {
  return loop.reduce((sum, a, i) => {
    const b = loop[(i + 1) % loop.length] as Point;
    return sum + (a.x * b.y - b.x * a.y) / 2;
  }, 0);
}

/** True when the point is inside the closed outline (even-odd rule). */
export function insideLoop(point: Point, loop: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i, i += 1) {
    const a = loop[i] as Point;
    const b = loop[j] as Point;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const key = (a: number, b: number): string => (a < b ? `${a} ${b}` : `${b} ${a}`);

/** The edges that belong to one triangle only, in the direction that triangle runs them. */
export function openEdges(triangles: readonly Triangle[]): (readonly [number, number])[] {
  const count = new Map<string, number>();
  const sides = triangles.flatMap(([a, b, c]) => [[a, b], [b, c], [c, a]] as const);
  for (const [a, b] of sides) count.set(key(a, b), (count.get(key(a, b)) ?? 0) + 1);
  return sides.filter(([a, b]) => count.get(key(a, b)) === 1);
}

/** Points on a grid of equal triangles, inside the outline and kept clear of the lines given. */
function gridPoints(loop: readonly Point[], lines: readonly Polyline[], spacing: number): Point[] {
  const xs = loop.map((p) => p.x);
  const ys = loop.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const rowStep = (spacing * Math.sqrt(3)) / 2;
  const clearance = spacing * 0.6;
  const out: Point[] = [];
  for (let row = 0; minY + row * rowStep <= maxY; row += 1) {
    const offset = row % 2 === 0 ? 0 : spacing / 2;
    for (let x = minX + offset; x <= maxX; x += spacing) {
      const point = { x, y: minY + row * rowStep };
      if (insideLoop(point, loop) && lines.every((line) => distanceToPolyline(point, line) >= clearance)) out.push(point);
    }
  }
  return out;
}

function unique(points: readonly Point[]): Point[] {
  const seen = new Set<string>();
  return points.filter((p) => {
    const id = `${p.x} ${p.y}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const signedArea = (points: readonly Point[], [a, b, c]: Triangle): number => {
  const [p, q, r] = [points[a] as Point, points[b] as Point, points[c] as Point];
  return ((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / 2;
};

function delaunay(points: readonly Point[]): Triangle[] {
  const d = Delaunator.from([...points], (p) => p.x, (p) => p.y);
  const out: Triangle[] = [];
  for (let i = 0; i < d.triangles.length; i += 3) out.push([d.triangles[i] as number, d.triangles[i + 1] as number, d.triangles[i + 2] as number]);
  return out;
}

/** The border segments (indices into the loop) that no triangle has as an edge. */
function missingBorder(loopLength: number, triangles: readonly Triangle[]): number[] {
  const edges = new Set(triangles.flatMap(([a, b, c]) => [key(a, b), key(b, c), key(c, a)]));
  return Array.from({ length: loopLength }, (_, i) => i).filter((i) => !edges.has(key(i, (i + 1) % loopLength)));
}

const midpoint = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

function splitSegments(loop: readonly Point[], split: ReadonlySet<number>): Point[] {
  return loop.flatMap((p, i) => (split.has(i) ? [p, midpoint(p, loop[(i + 1) % loop.length] as Point)] : [p]));
}

/** The triangles inside the outline, all turned the same way, with none flat. */
function keptInside(points: readonly Point[], all: readonly Triangle[], loop: readonly Point[]): Triangle[] {
  return all
    .filter((t) => {
      const [a, b, c] = [points[t[0]] as Point, points[t[1]] as Point, points[t[2]] as Point];
      return insideLoop({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, loop);
    })
    .map((t): Triangle => (signedArea(points, t) < 0 ? [t[0], t[2], t[1]] : t))
    .filter((t) => signedArea(points, t) > 1e-9);
}

/**
 * Inside edges whose two ends are both on the border. The form is flat along the border,
 * so such an edge would pinch the front and the back together; it is split instead.
 */
export function chordsOf(triangles: readonly Triangle[]): (readonly [number, number])[] {
  const border = new Set(openEdges(triangles).flat());
  const open = new Set(openEdges(triangles).map(([a, b]) => key(a, b)));
  const seen = new Set<string>();
  return triangles
    .flatMap(([a, b, c]) => [[a, b], [b, c], [c, a]] as const)
    .filter(([a, b]) => {
      const id = key(a, b);
      if (open.has(id) || seen.has(id) || !border.has(a) || !border.has(b)) return false;
      seen.add(id);
      return true;
    });
}

const MAX_ROUNDS = 20;

/**
 * Splits the inside of a closed outline into small triangles of about `spacing` across,
 * with points spread through the inside so that the surface can be given a shape. The
 * outline is followed exactly: a border segment the triangles miss is split at its middle
 * and the work is done again. Points along `lines` are added so that the triangles follow
 * them closely too.
 */
export function triangulateRegion(outline: readonly Point[], lines: readonly (readonly Point[])[], spacing: number): Region {
  let loop = resample(outline, spacing / 2, true);
  const linePoints = lines.flatMap((line) => resample(line, spacing / 2, false)).filter((p) => insideLoop(p, loop));
  const clearOf: Polyline[] = [{ points: loop, closed: true }, ...lines.map((line) => ({ points: line, closed: false }))];
  let inner = unique([...linePoints, ...gridPoints(loop, clearOf, spacing)]);
  for (let round = 0; ; round += 1) {
    const points = [...loop, ...inner];
    const all = delaunay(points);
    const missing = missingBorder(loop.length, all);
    const last = round === MAX_ROUNDS;
    if (missing.length > 0 && !last) {
      loop = splitSegments(loop, new Set(missing));
      continue;
    }
    const kept = keptInside(points, all, loop);
    const chords = last ? [] : chordsOf(kept);
    if (chords.length === 0) return { points, triangles: kept };
    inner = [...inner, ...chords.map(([a, b]) => midpoint(points[a] as Point, points[b] as Point))];
  }
}
