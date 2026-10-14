import { roundMm, type BoundsMm, type PointMm } from "@/lib/artwork-stack/units";

/** The small geometry the generators share. Points are millimetres; results are rounded to 0.01 mm by `rounded`. */

export const rectPolygon = (box: BoundsMm): PointMm[] => [
  { x: box.minX, y: box.minY },
  { x: box.maxX, y: box.minY },
  { x: box.maxX, y: box.maxY },
  { x: box.minX, y: box.maxY },
];

export const rounded = (points: readonly PointMm[]): PointMm[] => points.map((point) => ({ x: roundMm(point.x), y: roundMm(point.y) }));

export const rotatePoint = (point: PointMm, centre: PointMm, degrees: number): PointMm => {
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  const [dx, dy] = [point.x - centre.x, point.y - centre.y];
  return { x: centre.x + dx * cos - dy * sin, y: centre.y + dx * sin + dy * cos };
};

/** The unit vector pointing `degrees` clockwise from the x axis (y runs down, as on a flat). */
export const directionOf = (degrees: number): PointMm => {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
};

export const dot = (a: PointMm, b: PointMm): number => a.x * b.x + a.y * b.y;

export const boxesOverlap = (a: BoundsMm, b: BoundsMm): boolean => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

export const boxOf = (points: readonly PointMm[]): BoundsMm => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y)),
});

/** The part of a box inside another, or null when they only touch or miss. */
export function intersectBoxes(a: BoundsMm, b: BoundsMm): BoundsMm | null {
  const box = { minX: Math.max(a.minX, b.minX), minY: Math.max(a.minY, b.minY), maxX: Math.min(a.maxX, b.maxX), maxY: Math.min(a.maxY, b.maxY) };
  return box.minX < box.maxX && box.minY < box.maxY ? box : null;
}

type Edge = (point: PointMm) => number;
const crossing = (a: PointMm, b: PointMm, da: number, db: number): PointMm => {
  const t = da / (da - db);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

function clipEdge(points: readonly PointMm[], inside: Edge): PointMm[] {
  return points.flatMap((current, at) => {
    const previous = points[(at + points.length - 1) % points.length] as PointMm;
    const [dc, dp] = [inside(current), inside(previous)];
    if (dc >= 0) return dp >= 0 ? [current] : [crossing(previous, current, dp, dc), current];
    return dp >= 0 ? [crossing(previous, current, dp, dc)] : [];
  });
}

/** A polygon cut to a box (Sutherland and Hodgman). Null when nothing is left. */
export function clipPolygon(points: readonly PointMm[], box: BoundsMm): PointMm[] | null {
  const edges: Edge[] = [(p) => p.x - box.minX, (p) => box.maxX - p.x, (p) => p.y - box.minY, (p) => box.maxY - p.y];
  const clipped = edges.reduce<PointMm[]>((run, edge) => (run.length === 0 ? run : clipEdge(run, edge)), [...points]);
  return clipped.length < 3 ? null : clipped;
}

/** A polygon scaled about a point. */
export const scaleAbout = (points: readonly PointMm[], centre: PointMm, factor: number): PointMm[] =>
  points.map((point) => ({ x: centre.x + (point.x - centre.x) * factor, y: centre.y + (point.y - centre.y) * factor }));

/** A regular polygon with `sides` corners, the first at `startDegrees`. */
export const regularPolygon = (centre: PointMm, radius: number, sides: number, startDegrees: number): PointMm[] =>
  Array.from({ length: sides }, (_, at) => {
    const direction = directionOf(startDegrees + (360 * at) / sides);
    return { x: centre.x + direction.x * radius, y: centre.y + direction.y * radius };
  });
