import type { DisplayList, DisplayShape } from "@/lib/artwork-stack/generator";
import { canonicalDisplayList } from "@/lib/artwork-stack/generator";
import type { PointMm } from "@/lib/artwork-stack/units";

function insidePolygon(point: PointMm, corners: readonly PointMm[]): boolean {
  return corners.reduce((inside, corner, at) => {
    const before = corners[(at + corners.length - 1) % corners.length];
    const crosses = corner.y > point.y !== before.y > point.y && point.x < ((before.x - corner.x) * (point.y - corner.y)) / (before.y - corner.y) + corner.x;
    return crosses ? !inside : inside;
  }, false);
}

const covers = (shape: DisplayShape, point: PointMm): boolean =>
  shape.kind === "circle" ? Math.hypot(point.x - shape.centre.x, point.y - shape.centre.y) <= shape.radius : insidePolygon(point, shape.points);

/** The colour a display list gives one point: the last shape drawn there, else the colour under it. */
export function colourAt(list: DisplayList, ground: string, point: PointMm): string {
  const top = [...list.shapes].reverse().find((shape) => covers(shape, point));
  return top?.fill ?? ground;
}

/** A short fingerprint of a display list at 0.01 mm. Equal lists have equal fingerprints on any machine. */
export function displayListHash(list: DisplayList): string {
  const text = canonicalDisplayList(list);
  const [h1, h2] = Array.from(text).reduce<[number, number]>(
    ([a, b], char) => {
      const code = char.charCodeAt(0);
      return [Math.imul(a ^ code, 2654435761), Math.imul(b ^ code, 1597334677)];
    },
    [0xdeadbeef, 0x41c6ce57],
  );
  const mixed = [Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909), Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)];
  return mixed.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}
