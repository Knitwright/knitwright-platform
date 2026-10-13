import { describe, expect, it } from "vitest";
import { buildFlat } from "./build";
import { designWith, madeUpForType, typedIn } from "./fixtures/designs";
import { boundsOfPoints, crossesItself, distanceToPolyline, flatten } from "./geometry";
import type { FlatModel, FlatPath, Point, View } from "./model";

/**
 * What defines the shape of each collar, neckband, side panel and sleeve. The sizes are
 * made up, with believable proportions. These tests describe the garment, not the code.
 */

const drawn = (typeId: string, choices: Record<string, string>, view: View = "front"): { model: FlatModel; values: Record<string, number> } => {
  const values = { ...madeUpForType(typeId, choices) };
  const spec = designWith(typeId, choices, values);
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
  if (!model) throw new Error("No drawing");
  return { model, values };
};

const paths = (model: FlatModel, layer: string): FlatPath[] =>
  (model.layers.find((entry) => entry.id === layer)?.elements ?? []).filter((element): element is FlatPath => element.kind === "path");

const panel = (model: FlatModel, panelId: string): FlatPath => {
  const found = paths(model, "panels").find((path) => path.panelId === panelId);
  if (!found) throw new Error(`No ${panelId}`);
  return found;
};

const pointsOf = (path: FlatPath): Point[] => flatten(path.commands).flatMap((run) => run.points);
const runsOf = (path: FlatPath) => flatten(path.commands);

/** How many times a horizontal line crosses an outline. */
function crossings(path: FlatPath, y: number): number[] {
  const xs: number[] = [];
  for (const run of runsOf(path)) {
    const points = run.closed ? [...run.points, run.points[0] as Point] : run.points;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1] as Point;
      const b = points[i] as Point;
      if ((a.y - y) * (b.y - y) < 0) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  return xs.sort((p, q) => p - q);
}

const landmark = (model: FlatModel, name: string): Point => {
  const point = model.landmarks[name];
  if (!point) throw new Error(`No landmark ${name}`);
  return point;
};

const brightnessOf = (hex: string): number => {
  const n = Number.parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

describe("a polo, seen from the front", () => {
  const { model, values } = drawn("polo", {});
  const collar = panel(model, "collar");
  const neckBottom = landmark(model, "neck-bottom");
  const height = values["collar-height"] as number;
  const chest = values["chest-width"] as number;

  it("has a neck opening about a third of the shoulder width", () => {
    const ratio = (values["neck-width"] as number) / (values["shoulder-width"] as number);
    expect(ratio).toBeGreaterThan(0.28);
    expect(ratio).toBeLessThan(0.38);
  });

  it("has two collar leaves whose points lie below the neckline, one each side of the centre line, spread apart over the placket", () => {
    const lowest = pointsOf(collar).reduce((best, point) => (point.y > best.y ? point : best));
    expect(lowest.y).toBeGreaterThan(neckBottom.y + 0.3 * height);
    const right = pointsOf(collar).filter((point) => point.x > 0).reduce((best, point) => (point.y > best.y ? point : best));
    const left = pointsOf(collar).filter((point) => point.x < 0).reduce((best, point) => (point.y > best.y ? point : best));
    expect(right.y).toBeCloseTo(left.y, 0);
    expect(right.x).toBeCloseTo(-left.x, 0);
    expect(Math.abs(right.x)).toBeGreaterThan((values["placket-width"] as number) / 2);
    expect(Math.abs(right.x)).toBeLessThan(0.1 * chest);
  });

  it("comes to a point at each tip and leaves a gap between the leaves", () => {
    const y = neckBottom.y + 0.25 * height;
    const across = crossings(collar, y);
    expect(across).toHaveLength(4);
    expect((across[2] as number) - (across[1] as number)).toBeGreaterThan(0);
    expect((across[2] as number) - (across[1] as number)).toBeLessThan(0.1 * chest);
    // Pointed: a short way above the tip the leaf is much wider than it is close to the tip.
    const widthAt = (y: number) => {
      const xs = crossings(collar, y);
      return (xs[1] as number) - (xs[0] as number);
    };
    expect(widthAt(neckBottom.y + 0.1 * height)).toBeGreaterThan(2.5 * widthAt(neckBottom.y + 0.45 * height));
  });

  it("lies flat: the back of the collar sits a little above the shoulder line and does not rise round the head like a hood", () => {
    const highest = Math.min(...pointsOf(collar).map((point) => point.y));
    expect(highest).toBeLessThan(-0.15 * height);
    expect(highest).toBeGreaterThan(-0.5 * height);
    // What shows through the opening is the inside of the back below the back neck seam, never above the shoulder line.
    const inside = paths(model, "panels").find((path) => path.name === "Inside of the neck") as FlatPath;
    expect(Math.min(...pointsOf(inside).map((point) => point.y))).toBeGreaterThanOrEqual(-0.5);
  });

  it("has a visible fold line on each leaf", () => {
    const lines = paths(model, "details").filter((path) => path.name.startsWith("Collar fold line"));
    expect(lines).toHaveLength(2);
    const [right, left] = lines as [FlatPath, FlatPath];
    expect(Math.min(...pointsOf(right).map((p) => p.x))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...pointsOf(left).map((p) => p.x))).toBeLessThanOrEqual(0);
    for (const line of lines) for (const point of pointsOf(line)) expect(distanceToPolyline(point, runsOf(collar)[0]!)).toBeGreaterThan(0.5);
  });

  it("starts the placket at the neckline, under the collar, with the top button near the top", () => {
    const placket = panel(model, "placket");
    expect(Math.min(...pointsOf(placket).map((p) => p.y))).toBeCloseTo(neckBottom.y, 0);
    const buttons = paths(model, "details").filter((path) => path.name.startsWith("Button"));
    const centres = buttons.map((button) => {
      const box = boundsOfPoints(pointsOf(button));
      return (box.minY + box.maxY) / 2;
    });
    const length = values["placket-length"] as number;
    const tips = Math.max(...pointsOf(collar).map((p) => p.y));
    expect(centres[0]).toBeGreaterThan(tips);
    expect((centres[0] as number) - neckBottom.y).toBeLessThan(0.45 * length);
    expect(Math.max(...centres)).toBeLessThan(neckBottom.y + length);
  });

  it("draws the placket before the collar, so the leaves lie over the top of it", () => {
    const order = paths(model, "panels").map((path) => path.panelId);
    expect(order.indexOf("placket")).toBeLessThan(order.indexOf("collar"));
  });
});

describe("the silhouette of a polo", () => {
  it.each(["front", "back"] as const)("has no step of no length from the %s, so the 3D form can be made from it", (view) => {
    const { model } = drawn("polo", {}, view);
    const [run] = flatten(model.outline.silhouette);
    const points = run?.points ?? [];
    expect(points.length).toBeGreaterThan(3);
    const repeats = points.slice(1).filter((point, index) => point.x === points[index]?.x && point.y === points[index]?.y);
    expect(repeats).toEqual([]);
  });
});

describe("a polo, seen from the back", () => {
  const { model, values } = drawn("polo", {}, "back");
  const collar = panel(model, "collar");

  it("is the fall of the collar: folded at the top, hanging just over the back neck seam, and out to each shoulder", () => {
    const neckBottom = landmark(model, "neck-bottom");
    const height = values["collar-height"] as number;
    const top = pointsOf(collar).reduce((best, point) => (point.y < best.y ? point : best));
    expect(Math.abs(top.x)).toBeLessThan(0.05 * (values["chest-width"] as number));
    expect(top.y).toBeLessThan(neckBottom.y - 0.5 * height);
    expect(top.y).toBeGreaterThan(neckBottom.y - height);
    // The fall covers the back neck seam, and hangs only a little below it.
    const lowest = pointsOf(collar).reduce((best, point) => (point.y > best.y ? point : best));
    expect(lowest.y).toBeGreaterThan(neckBottom.y);
    expect(lowest.y).toBeLessThan(neckBottom.y + 0.5 * height);
    const widest = Math.max(...pointsOf(collar).map((point) => Math.abs(point.x)));
    expect(widest).toBeGreaterThan((values["neck-width"] as number) / 2 + 0.5 * height);
  });

  it("is a curved band and not a rectangle: its top edge is higher in the middle than at the ends", () => {
    const highest = Math.min(...pointsOf(collar).map((p) => p.y));
    const endsHighest = Math.min(...pointsOf(collar).filter((p) => Math.abs(p.x) > 0.95 * Math.max(...pointsOf(collar).map((q) => Math.abs(q.x)))).map((p) => p.y));
    expect(endsHighest).toBeGreaterThan(highest + 0.15 * (values["collar-height"] as number));
  });
});

describe("a band collar", () => {
  for (const view of ["front", "back"] as const) {
    it(`has a gently curved top edge and no horns above the shoulder line, seen from the ${view}`, () => {
      const { model, values } = drawn("team-jersey", { collar: "band-collar", placket: "zip" }, view);
      const collar = panel(model, "collar");
      const height = values["collar-height"] as number;
      const highest = Math.min(...pointsOf(collar).map((p) => p.y));
      expect(highest).toBeGreaterThanOrEqual(-height - 1);
      const edge = Math.max(...pointsOf(collar).map((p) => Math.abs(p.x)));
      const atEnds = pointsOf(collar).filter((p) => Math.abs(p.x) > 0.9 * edge);
      expect(Math.min(...atEnds.map((p) => p.y))).toBeGreaterThan(-0.55 * height);
      expect(crossesItself(runsOf(collar))).toBe(false);
    });
  }

  it("has a zip that runs through the band to its top edge", () => {
    const { model, values } = drawn("team-jersey", { collar: "band-collar", placket: "zip" });
    const collar = panel(model, "collar");
    const topAtCentre = Math.min(...crossings(collar, 0.0).concat(pointsOf(collar).filter((p) => Math.abs(p.x) < 5).map((p) => p.y)));
    const teeth = paths(model, "details").filter((path) => path.name.startsWith("Zip teeth"));
    const highestTooth = Math.min(...teeth.flatMap((path) => pointsOf(path).map((p) => p.y)));
    const centreTop = Math.min(...pointsOf(collar).filter((p) => Math.abs(p.x) < 60).map((p) => p.y));
    expect(highestTooth).toBeCloseTo(centreTop, -1);
    expect(topAtCentre).toBeDefined();
    expect(values["placket-length"]).toBeGreaterThan(0);
  });
});

describe("a neckband on a V neck", () => {
  for (const raglan of [false, true]) {
    for (const view of ["front", "back"] as const) {
      it(`joins the ${raglan ? "raglan" : "shoulder"} seams cleanly and nothing sticks out above them, seen from the ${view}`, () => {
        const choices = { neckline: "v-neck", ...(raglan ? { "sleeve-type": "raglan" } : {}) };
        const { model } = drawn("team-jersey", choices, view);
        const band = panel(model, "neckband");
        const start = landmark(model, "neck-seam-start");
        const far = raglan ? landmark(model, "sleeve-end-right") : landmark(model, "sleeve-start-right");
        const slope = (far.y - start.y) / (far.x - start.x);
        const lineY = (x: number): number => start.y + slope * (x - start.x);
        for (const point of pointsOf(band).filter((p) => p.x > 0 && p.x <= start.x + 0.5)) {
          expect(point.y, `x=${point.x}`).toBeGreaterThanOrEqual(lineY(point.x) - 0.6);
        }
        // The outer end of the band is where the shoulder line begins.
        const outer = pointsOf(band).filter((p) => p.x > 0).reduce((best, point) => (point.x > best.x ? point : best));
        expect(outer.x).toBeCloseTo(start.x, 0);
        expect(outer.y).toBeCloseTo(0, 0);
        expect(crossesItself(runsOf(band))).toBe(false);
      });
    }
  }

  it("follows the V at the front and the round back neckline at the back", () => {
    const front = panel(drawn("team-jersey", { neckline: "v-neck" }).model, "neckband");
    const back = panel(drawn("team-jersey", { neckline: "v-neck" }, "back").model, "neckband");
    const depth = (path: FlatPath) => Math.max(...pointsOf(path).map((p) => p.y));
    expect(depth(front)).toBeGreaterThan(depth(back) + 500);
    expect(front.commands.filter((command) => command.op === "C")).toHaveLength(0);
    expect(back.commands.filter((command) => command.op === "C").length).toBeGreaterThan(0);
  });
});

describe("the inside of the neck opening, seen from the front", () => {
  it.each([
    ["a plain crew tee", "crew-tee", {}],
    ["a V neck tee", "v-neck-tee", {}],
    ["a polo", "polo", {}],
    ["a jersey with a band collar", "team-jersey", { collar: "band-collar" }],
  ])("%s shows the inside back in a darker tone of the body colour, not the blank page", (_name, typeId, choices) => {
    const { model } = drawn(typeId, choices);
    const inside = paths(model, "panels").find((path) => path.name === "Inside of the neck");
    expect(inside).toBeDefined();
    expect(inside?.panelId).toBeNull();
    const body = panel(model, "body-front");
    expect(brightnessOf(inside?.fill as string)).toBeLessThan(brightnessOf(body.fill as string));
    expect(runsOf(inside as FlatPath).every((run) => run.closed)).toBe(true);
    expect(crossesItself(runsOf(inside as FlatPath))).toBe(false);
    const box = boundsOfPoints(pointsOf(inside as FlatPath));
    expect(box.maxY - box.minY).toBeGreaterThan(50);
    expect(paths(model, "panels")[0]).toBe(inside);
  });

  it("is not drawn on the back", () => {
    expect(paths(drawn("crew-tee", {}, "back").model, "panels").some((path) => path.name === "Inside of the neck")).toBe(false);
  });
});

describe("side panels", () => {
  const { model } = drawn("team-jersey", { "side-panels": "contrast-insert", "hem-shape": "curved" });
  const strip = panel(model, "side-panels");
  const right = { ...strip, commands: strip.commands.slice(0, strip.commands.findIndex((c) => c.op === "Z") + 1) };
  const seams = paths(model, "seams");
  const armhole = runsOf(seams.find((p) => p.name === "Armhole seam, right") as FlatPath)[0]!;
  const sideSeam = pointsOf(seams.find((p) => p.name === "Side seam, right") as FlatPath);

  it("has its outer edge on the side seam, from the underarm to the hem", () => {
    const under = landmark(model, "underarm-right");
    for (const point of sideSeam) expect(distanceToPolyline(point, runsOf(right)[0]!)).toBeLessThan(0.6);
    expect(distanceToPolyline(under, runsOf(right)[0]!)).toBeLessThan(0.6);
  });

  it("is shaped at the top: its inner end lies on the armhole seam, not across a flat line", () => {
    const onArmhole = pointsOf(right).filter((p) => distanceToPolyline(p, armhole) < 0.6);
    const under = landmark(model, "underarm-right");
    const away = onArmhole.filter((p) => Math.hypot(p.x - under.x, p.y - under.y) > 150);
    expect(away.length).toBeGreaterThan(3);
  });

  it("is shaped at the bottom: it follows the curved hem", () => {
    const bottom = Math.max(...pointsOf(right).map((p) => p.y));
    const lowest = pointsOf(right).filter((p) => p.y > bottom - 5);
    expect(lowest.length).toBeGreaterThan(0);
    const hemY = pointsOf(right).filter((p) => p.x < Math.max(...pointsOf(right).map((q) => q.x)) - 100 && p.y > bottom - 120);
    expect(hemY.length).toBeGreaterThan(3);
  });

  it("narrows towards the underarm: much thinner just below it than near the hem", () => {
    const under = landmark(model, "underarm-right");
    const hemPoint = boundsOfPoints(pointsOf(right)).maxY;
    const spanAt = (y: number): number => {
      const xs = crossings(right, y);
      return (xs.at(-1) as number) - (xs[0] as number);
    };
    const near = spanAt(under.y + 0.06 * (hemPoint - under.y));
    const far = spanAt(under.y + 0.6 * (hemPoint - under.y));
    expect(far).toBeGreaterThan(1.5 * near);
    expect(crossesItself(runsOf(strip))).toBe(false);
  });
});

describe("sleeves", () => {
  it.each([
    ["short set in", "crew-tee", {}],
    ["long set in", "long-sleeve-tee", {}],
    ["short raglan", "team-jersey", { "sleeve-type": "raglan" }],
    ["long raglan", "team-jersey", { "sleeve-type": "raglan", "sleeve-length": "long" }],
  ])("%s: the opening is as wide as measured and the sleeve hangs at a natural angle", (_name, typeId, choices) => {
    const { model, values } = drawn(typeId, choices);
    const start = landmark(model, "sleeve-start-right");
    const end = landmark(model, "sleeve-end-right");
    const lower = landmark(model, "sleeve-opening-lower");
    expect(Math.abs(Math.hypot(lower.x - end.x, lower.y - end.y) - (values["sleeve-opening"] as number))).toBeLessThanOrEqual(1);
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
    expect(angle).toBeGreaterThan(18);
    expect(angle).toBeLessThan(55);
  });
});
