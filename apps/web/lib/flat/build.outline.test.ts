import { describe, expect, it } from "vitest";
import { buildFlat } from "./build";
import { TOPS_TYPE_IDS, designWith, madeUpForType, pairwise, typedIn } from "./fixtures/designs";
import { boundsOfPoints, crossesItself, distanceToPolyline, flatten, type Polyline } from "./geometry";
import type { FlatModel, Point, View } from "./model";

/**
 * Step 9A builds a 3D form from one outline of each view, so the outline is part of the
 * model: the whole garment as one closed silhouette, and the boundary of the neck opening.
 */

const draw = (typeId: string, choices: Record<string, string>, view: View): FlatModel => {
  const spec = designWith(typeId, choices, madeUpForType(typeId, choices));
  return buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" }) as FlatModel;
};

function inside(point: Point, run: Polyline): boolean {
  let inPolygon = false;
  const points = run.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i] as Point;
    const b = points[j] as Point;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inPolygon = !inPolygon;
  }
  return inPolygon;
}

const cases = TOPS_TYPE_IDS.flatMap((typeId) =>
  pairwise(typeId).flatMap((choices) => (["front", "back"] as const).map((view) => ({ typeId, choices, view, label: `${typeId} ${view} ${Object.values(choices).join("/")}` }))),
);

describe.each(cases.map((item) => [item.label, item] as const))("%s", (_label, item) => {
  const model = draw(item.typeId, item.choices, item.view);
  const silhouette = flatten(model.outline.silhouette);

  it("has one closed silhouette that does not cross itself", () => {
    expect(silhouette).toHaveLength(1);
    expect(silhouette[0]?.closed).toBe(true);
    expect(crossesItself(silhouette)).toBe(false);
  });

  it("encloses every panel", () => {
    const run = silhouette[0] as Polyline;
    const panels = model.layers.find((layer) => layer.id === "panels")?.elements ?? [];
    for (const element of panels) {
      if (element.kind !== "path" || element.panelId === null) continue;
      for (const point of flatten(element.commands).flatMap((part) => part.points)) {
        const near = distanceToPolyline(point, run) < 1.5;
        expect(near || inside(point, run), `${element.name} at ${point.x},${point.y}`).toBe(true);
      }
    }
  });

  it("is a mirror image about the centre line", () => {
    const run = silhouette[0] as Polyline;
    for (const point of run.points) expect(distanceToPolyline({ x: -point.x, y: point.y }, run)).toBeLessThan(0.6);
  });

  it("has a neck opening that is one closed loop, inside the box of the silhouette, and symmetrical", () => {
    const loops = flatten(model.outline.neck);
    expect(loops).toHaveLength(1);
    expect(loops[0]?.closed).toBe(true);
    expect(crossesItself(loops)).toBe(false);
    const box = boundsOfPoints((silhouette[0] as Polyline).points);
    for (const point of (loops[0] as Polyline).points) {
      expect(point.x).toBeGreaterThanOrEqual(box.minX - 1e-6);
      expect(point.x).toBeLessThanOrEqual(box.maxX + 1e-6);
      expect(distanceToPolyline({ x: -point.x, y: point.y }, loops[0] as Polyline)).toBeLessThan(0.6);
    }
  });
});

describe("the outline and the layers", () => {
  it("is extra data: the layers are the same as before", () => {
    expect(draw("crew-tee", {}, "front").layers.map((layer) => layer.id)).toEqual(["panels", "seams", "stitching", "details", "artwork"]);
  });

  it("makes the sleeves part of the silhouette: it is as wide as the whole drawing of the sleeves", () => {
    const model = draw("crew-tee", {}, "front");
    const box = boundsOfPoints(flatten(model.outline.silhouette).flatMap((run) => run.points));
    const end = model.landmarks["sleeve-end-right"] as Point;
    expect(box.maxX).toBeGreaterThanOrEqual(end.x - 0.1);
    expect(box.minX).toBeCloseTo(-box.maxX, 1);
  });
});
