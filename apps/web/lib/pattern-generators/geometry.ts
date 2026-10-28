import type { DisplayCircle, DisplayPolygon, DisplayShape } from "@/lib/artwork-stack/generator";
import { roundMm, type BoundsMm, type PointMm } from "@/lib/artwork-stack/units";

/** Every point is rounded to 0.01 mm when a shape is made, so output is the same on any machine. */
export const polygon = (points: readonly PointMm[], fill: string, name?: string): DisplayPolygon => ({
  kind: "polygon",
  points: points.map((point) => ({ x: roundMm(point.x), y: roundMm(point.y) })),
  fill,
  ...(name === undefined ? {} : { name }),
});

export const circle = (centre: PointMm, radius: number, fill: string, name?: string): DisplayCircle => ({
  kind: "circle",
  centre: { x: roundMm(centre.x), y: roundMm(centre.y) },
  radius: roundMm(radius),
  fill,
  ...(name === undefined ? {} : { name }),
});

const rectPoints = (x0: number, y0: number, x1: number, y1: number): PointMm[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

export const rectangle = (x0: number, y0: number, x1: number, y1: number, fill: string, name?: string): DisplayPolygon =>
  polygon(rectPoints(x0, y0, x1, y1), fill, name);

/** A shape's local points moved to `origin`. */
export const placed = (origin: PointMm, local: readonly PointMm[]): PointMm[] => local.map((point) => ({ x: origin.x + point.x, y: origin.y + point.y }));

export const rotateAbout = (point: PointMm, centre: PointMm, degrees: number): PointMm => {
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  const [dx, dy] = [point.x - centre.x, point.y - centre.y];
  return { x: centre.x + dx * cos - dy * sin, y: centre.y + dx * sin + dy * cos };
};

/** The box around a shape. */
export function boxOf(shape: DisplayShape): BoundsMm {
  if (shape.kind === "circle") {
    const { centre, radius } = shape;
    return { minX: centre.x - radius, minY: centre.y - radius, maxX: centre.x + radius, maxY: centre.y + radius };
  }
  const xs = shape.points.map((point) => point.x);
  const ys = shape.points.map((point) => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export const overlaps = (a: BoundsMm, b: BoundsMm): boolean => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Leaves out the shapes that cannot touch the bounds. What is left looks the same inside the bounds. */
export const cullTo = (shapes: readonly DisplayShape[], bounds: BoundsMm): DisplayShape[] => shapes.filter((shape) => overlaps(boxOf(shape), bounds));

/** Whole numbers from `from` up to and including `to`. */
export const span = (from: number, to: number): number[] => (to < from ? [] : Array.from({ length: to - from + 1 }, (_, at) => from + at));
