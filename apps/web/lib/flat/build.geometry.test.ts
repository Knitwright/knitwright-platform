import { describe, expect, it } from "vitest";
import { panelsFor } from "@/lib/garment";
import { buildFlat, visiblePanels } from "./build";
import { TOPS_TYPE_IDS, designWith, madeUpValues, pairwise, typedIn } from "./fixtures/designs";
import { boundsOfPoints, crossesItself, distanceToPolyline, extentPoints, flatten, type Polyline } from "./geometry";
import type { FlatModel, FlatPath, Point, View } from "./model";

/**
 * The geometry rules, checked on a short list of option combinations for every tops
 * type (all pairs of choices meet at least once), on both views and on three made-up
 * sizes. The measurements are invented and are not real garment data.
 */

const SCALES = [0.9, 1, 1.12] as const;
const VIEWS: readonly View[] = ["front", "back"];
const MIRROR_TOLERANCE = 0.5;
const ONE_TENTH_MM = 1;

interface Case {
  readonly label: string;
  readonly typeId: string;
  readonly choices: Readonly<Record<string, string>>;
  readonly scale: number;
  readonly view: View;
}

const cases: Case[] = TOPS_TYPE_IDS.flatMap((typeId) =>
  pairwise(typeId).flatMap((choices) =>
    SCALES.flatMap((scale) =>
      VIEWS.map((view) => ({
        label: `${typeId} ${view} x${scale} ${Object.values(choices).join("/")}`,
        typeId,
        choices,
        scale,
        view,
      })),
    ),
  ),
);

const modelOf = (item: Case): FlatModel => {
  const spec = designWith(item.typeId, item.choices, madeUpValues(item.choices, item.scale));
  const model = buildFlat({ spec, measurements: typedIn(spec), view: item.view, colourwayId: "main" });
  if (!model) throw new Error("No drawing");
  return model;
};

const panels = (model: FlatModel): FlatPath[] =>
  (model.layers.find((layer) => layer.id === "panels")?.elements ?? []).filter(
    (element): element is FlatPath => element.kind === "path",
  );

const runsOf = (path: FlatPath): readonly Polyline[] => flatten(path.commands);

const mirrored = (run: Polyline): Point[] => run.points.map((point) => ({ x: -point.x, y: point.y }));

/** Every point of a path, reflected about the centre line, lies on the path of its partner. */
const reflects = (a: FlatPath, b: FlatPath): boolean => {
  const partner = runsOf(b);
  return runsOf(a).every((run) =>
    mirrored(run).every((point) => partner.some((other) => distanceToPolyline(point, other) < MIRROR_TOLERANCE)),
  );
};

/** Where an outline crosses a horizontal line: the leftmost and rightmost crossings. */
function widthAt(path: FlatPath, y: number): number {
  const xs: number[] = [];
  for (const run of runsOf(path)) {
    const points = run.closed ? [...run.points, run.points[0] as Point] : run.points;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1] as Point;
      const b = points[i] as Point;
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  return Math.max(...xs) - Math.min(...xs);
}

describe("the sampled combinations", () => {
  it("cover every type with a useful number of designs", () => {
    for (const typeId of TOPS_TYPE_IDS) expect(pairwise(typeId).length).toBeGreaterThanOrEqual(2);
    expect(cases.length).toBeGreaterThan(100);
  });
});

describe.each(cases.map((item) => [item.label, item] as const))("%s", (_label, item) => {
  const model = modelOf(item);
  const paths = panels(model);
  const spec = designWith(item.typeId, item.choices, madeUpValues(item.choices, item.scale));

  it("is drawn to scale", () => {
    expect(model.toScale).toBe(true);
    expect(model.problems).toEqual([]);
  });

  it("has exactly one closed path for each panel of the design that this view shows", () => {
    const wanted = visiblePanels(item.view, panelsFor(spec).map((panel) => panel.id));
    expect(paths.flatMap((path) => (path.panelId ? [path.panelId] : [])).sort()).toEqual([...wanted].sort());
    for (const path of paths) {
      const runs = runsOf(path);
      expect(runs.length).toBeGreaterThan(0);
      expect(runs.every((run) => run.closed)).toBe(true);
    }
  });

  it("has no panel that crosses itself", () => {
    for (const path of paths) expect(crossesItself(runsOf(path)), path.name).toBe(false);
  });

  it("is a mirror image about the centre line where the garment is symmetrical", () => {
    for (const path of paths) {
      if (path.panelId === "sleeve-left" || path.panelId === "sleeve-right") continue;
      expect(reflects(path, path), path.name).toBe(true);
    }
    const left = paths.find((path) => path.panelId === "sleeve-left") as FlatPath;
    const right = paths.find((path) => path.panelId === "sleeve-right") as FlatPath;
    expect(reflects(left, right)).toBe(true);
    expect(reflects(right, left)).toBe(true);
  });

  it("draws the chest width, the body length and the sleeve length as measured", () => {
    const values = madeUpValues(item.choices, item.scale);
    const body = paths.find((path) => path.panelId === `body-${item.view}`) as FlatPath;
    const underarm = model.landmarks["underarm-right"] as Point;
    expect(Math.abs(widthAt(body, underarm.y) - (values["chest-width"] as number))).toBeLessThanOrEqual(ONE_TENTH_MM);

    const bodyPoints = runsOf(body).flatMap((run) => run.points);
    const box = boundsOfPoints(bodyPoints);
    expect(Math.abs(box.maxY - box.minY - (values["body-length"] as number))).toBeLessThanOrEqual(ONE_TENTH_MM);

    const from = model.landmarks["sleeve-start-right"] as Point;
    const to = model.landmarks["sleeve-end-right"] as Point;
    expect(Math.abs(Math.hypot(to.x - from.x, to.y - from.y) - (values["sleeve-length"] as number))).toBeLessThanOrEqual(
      ONE_TENTH_MM,
    );
  });

  it("draws nothing outside its bounding box", () => {
    const { bounds } = model;
    const everything = model.layers.flatMap((layer) => layer.elements).flatMap((element) => extentPoints(element));
    for (const point of everything) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.minX - 1e-6);
      expect(point.x).toBeLessThanOrEqual(bounds.maxX + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(bounds.minY - 1e-6);
      expect(point.y).toBeLessThanOrEqual(bounds.maxY + 1e-6);
    }
  });
});

describe("one scale on both axes", () => {
  it("draws a button as a circle: its width equals its height", () => {
    const spec = designWith("polo", {}, madeUpValues({}));
    const model = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main" }) as FlatModel;
    const buttons = (model.layers.find((layer) => layer.id === "details")?.elements ?? []).filter(
      (element): element is FlatPath => element.kind === "path" && element.name.startsWith("Button"),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) {
      const box = boundsOfPoints(runsOf(button).flatMap((run) => run.points));
      expect(box.maxX - box.minX).toBeCloseTo(box.maxY - box.minY, 0);
    }
  });
});

describe("designs with the made-up size charts", () => {
  it("still give a closed, bounded drawing whatever the numbers are", async () => {
    const { MADE_UP_CHART_SET } = await import("@/lib/sizing/fixtures/made-up-charts");
    const { resolveMeasurements } = await import("@/lib/sizing");
    const spec = designWith("team-jersey", {});
    const sized = { ...spec, sizing: { sizes: ["U1", "U2", "U3", "U4"], baseSize: "U2" } } as typeof spec;
    for (const size of sized.sizing?.sizes ?? []) {
      const resolution = resolveMeasurements(sized, size, MADE_UP_CHART_SET);
      const model = buildFlat({ spec: sized, measurements: resolution, view: "front", colourwayId: "main" }) as FlatModel;
      expect(panels(model).length).toBeGreaterThan(3);
      for (const path of panels(model)) expect(runsOf(path).every((run) => run.closed)).toBe(true);
    }
  });
});
