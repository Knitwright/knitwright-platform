import type { DisplayList } from "@/lib/artwork-stack/generator";
import type { PointMm } from "@/lib/artwork-stack/units";

function inside(points: readonly PointMm[], at: PointMm): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [a, b] = [points[i] as PointMm, points[j] as PointMm];
    if (a.y > at.y !== b.y > at.y && at.x < ((b.x - a.x) * (at.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The colour a viewer sees at a point: the last shape drawn over it, else the ground. */
export function colourAt(list: DisplayList, at: PointMm, ground: string): string {
  for (let k = list.shapes.length - 1; k >= 0; k -= 1) {
    const shape = list.shapes[k];
    if (shape === undefined) continue;
    if (shape.kind === "circle" ? Math.hypot(at.x - shape.centre.x, at.y - shape.centre.y) <= shape.radius : inside(shape.points, at)) return shape.fill;
  }
  return ground;
}
