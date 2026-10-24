import { describe, expect, it } from "vitest";
import { getType, panelsFor, pointsOfMeasureFor, type GarmentSpec } from "@/lib/garment";
import { buildFlat, visiblePanels } from "./build";
import { designWith, pairwise, typedIn } from "./fixtures/designs";
import { DRAWN_FAMILIES, familyTypeIds, madeUpFamilyValues } from "./fixtures/family-designs";
import { crossesItself, distanceToPolyline, flatten, type Polyline } from "./geometry";
import { NOT_TO_SCALE_MISSING, type FlatModel, type FlatPath, type Point, type View } from "./model";
import { renderSvg } from "./render-svg";

/**
 * The geometry rules of step 7, for every family other than tops that has drawing code: on
 * all pairs of choices of every type, both views, with no measurements (drawn from
 * proportions) and with made-up measurements at three sizes. The numbers are invented.
 */

const VIEWS: readonly View[] = ["front", "back"];
const SCALES = [0.9, 1.12] as const;
const MIRROR_TOLERANCE = 0.6;
const PAIRED: Readonly<Record<string, string>> = { "sleeve-left": "sleeve-right", "sleeve-right": "sleeve-left" };

interface Case {
  readonly label: string;
  readonly typeId: string;
  readonly choices: Readonly<Record<string, string>>;
  /** Null for a design with no measurements at all. */
  readonly scale: number | null;
  readonly view: View;
}

const specOf = (item: Pick<Case, "typeId" | "choices" | "scale">): GarmentSpec =>
  designWith(item.typeId, item.choices, item.scale === null ? undefined : madeUpFamilyValues(item.typeId, item.choices, item.scale));

const draw = (spec: GarmentSpec, view: View, callouts = false): FlatModel => {
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main", callouts });
  if (!model) throw new Error(`No drawing for ${spec.typeId}.`);
  return model;
};

const cases: Case[] = familyTypeIds().flatMap((typeId) =>
  pairwise(typeId).flatMap((choices) =>
    [null, ...SCALES].flatMap((scale) =>
      VIEWS.map((view) => ({ label: `${typeId} ${view} ${scale ?? "no sizes"} ${Object.values(choices).join("/")}`, typeId, choices, scale, view })),
    ),
  ),
);

const panels = (model: FlatModel): FlatPath[] =>
  (model.layers.find((layer) => layer.id === "panels")?.elements ?? []).filter((element): element is FlatPath => element.kind === "path");

const runsOf = (path: FlatPath | readonly FlatPath["commands"][number][]): readonly Polyline[] =>
  flatten("commands" in path ? path.commands : path);

const reflects = (a: FlatPath, b: FlatPath): boolean =>
  runsOf(a).every((run) =>
    run.points.every((point) => runsOf(b).some((other) => distanceToPolyline({ x: -point.x, y: point.y }, other) < MIRROR_TOLERANCE)),
  );

function inside(point: Point, run: Polyline): boolean {
  let within = false;
  const points = run.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i] as Point;
    const b = points[j] as Point;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) within = !within;
  }
  return within;
}

describe("the families with drawing code", () => {
  it("include every family other than tops, and every one of their types is sampled", () => {
    expect([...DRAWN_FAMILIES].sort()).toEqual(["bottoms", "close-fitting", "cricket", "football", "outerwear", "winter-code"]);
    for (const typeId of familyTypeIds()) expect(pairwise(typeId).length, typeId).toBeGreaterThanOrEqual(1);
    expect(cases.length).toBeGreaterThan(50);
  });
});

describe.each(cases.map((item) => [item.label, item] as const))("%s", (_label, item) => {
  const spec = specOf(item);
  const model = draw(spec, item.view);
  const paths = panels(model);

  it("is to scale only when every measurement is there, and says so otherwise", () => {
    expect(model.toScale).toBe(item.scale !== null);
    expect(model.problems).toEqual([]);
    expect(model.notice).toBe(item.scale === null ? NOT_TO_SCALE_MISSING : null);
  });

  it("has exactly one closed path for each panel of the design that this view shows", () => {
    const wanted = visiblePanels(item.view, panelsFor(spec).map((panel) => panel.id));
    expect(paths.flatMap((path) => (path.panelId ? [path.panelId] : [])).sort()).toEqual([...wanted].sort());
    for (const path of paths) expect(runsOf(path).every((run) => run.closed), path.name).toBe(true);
  });

  it("has no panel that crosses itself", () => {
    for (const path of paths) expect(crossesItself(runsOf(path)), path.name).toBe(false);
  });

  it("is a mirror image about the centre line, with the sleeves mirroring each other", () => {
    for (const path of paths) {
      const partner = PAIRED[path.panelId ?? ""];
      const other = partner ? paths.find((candidate) => candidate.panelId === partner) : path;
      expect(other && reflects(path, other), path.name).toBe(true);
    }
  });

  it("has one closed, symmetrical silhouette that does not cross itself and holds every panel", () => {
    const silhouette = runsOf(model.outline.silhouette);
    expect(silhouette).toHaveLength(1);
    const run = silhouette[0] as Polyline;
    expect(run.closed).toBe(true);
    expect(crossesItself(silhouette)).toBe(false);
    for (const point of run.points) expect(distanceToPolyline({ x: -point.x, y: point.y }, run)).toBeLessThan(MIRROR_TOLERANCE);
    // As for tops, only the panels are held: the inside of the garment seen through the neck is not a panel.
    for (const path of paths.filter((entry) => entry.panelId !== null)) {
      for (const point of runsOf(path).flatMap((part) => part.points)) {
        expect(distanceToPolyline(point, run) < 1.5 || inside(point, run), `${path.name} at ${point.x},${point.y}`).toBe(true);
      }
    }
  });

  it("has an opening that is one closed loop that does not cross itself", () => {
    const loops = runsOf(model.outline.neck);
    expect(loops).toHaveLength(1);
    expect(loops[0]?.closed).toBe(true);
    expect(crossesItself(loops)).toBe(false);
  });
});

describe.each(familyTypeIds().map((typeId) => [typeId] as const))("%s", (typeId) => {
  const choices = {};
  const values = madeUpFamilyValues(typeId, choices);
  const spec = designWith(typeId, choices, values);

  it("carries no callout and no value when it has no measurements", () => {
    const model = draw(designWith(typeId, choices), "front", true);
    expect(model.layers.map((layer) => layer.id)).toEqual(["panels", "seams", "stitching", "details", "artwork"]);
    expect(model.layers.flatMap((layer) => layer.elements).filter((element) => element.kind === "text")).toEqual([]);
  });

  it("draws a callout for every point of measure in one of the two views, when to scale", () => {
    const labelled = new Set(
      VIEWS.flatMap((view) => draw(spec, view, true).layers.find((layer) => layer.id === "measurements")?.elements ?? [])
        .flatMap((element) => (element.kind === "text" ? [element.text] : [])),
    );
    for (const point of pointsOfMeasureFor(spec)) {
      expect([...labelled].some((text) => text.startsWith(`${point.label} `)), point.id).toBe(true);
    }
  });

  it("changes the drawing when any one measurement changes (M3)", () => {
    for (const [pointId, value] of Object.entries(values)) {
      const changed = designWith(typeId, choices, { ...values, [pointId]: Math.round(value * 1.03) });
      const before = VIEWS.map((view) => renderSvg(draw(spec, view, true)));
      const after = VIEWS.map((view) => renderSvg(draw(changed, view, true)));
      expect(after.join(), pointId).not.toBe(before.join());
    }
  });

  it("places artwork at every anchor of every panel that carries it", () => {
    const type = getType(typeId);
    for (const panel of type?.panels.filter((entry) => entry.anchors.length > 0) ?? []) {
      for (const anchor of panel.anchors) {
        const withArt: GarmentSpec = {
          ...spec,
          artwork: [
            {
              id: "art",
              name: "Badge",
              source: { kind: "text", text: "KW" },
              panelId: panel.id,
              anchor: anchor.id,
              offsetX: 0,
              offsetY: 0,
              width: 400,
              height: 200,
              rotationDegrees: 0,
              technique: "screen-print",
              provenance: "user-edited",
            },
          ],
        };
        const drawn = VIEWS.flatMap((view) => draw(withArt, view).layers.find((layer) => layer.id === "artwork")?.elements ?? []);
        expect(drawn.length, `${panel.id} ${anchor.id}`).toBe(1);
      }
    }
  });

  it("refuses measurements that cannot be drawn together, and falls back to proportions", () => {
    const first = Object.keys(values)[0] as string;
    const broken = designWith(typeId, choices, { ...values, [first]: Math.round((values[first] as number) * 3) });
    const model = draw(broken, "front");
    expect(model.toScale).toBe(false);
    expect(model.problems.length).toBeGreaterThan(0);
  });
});

describe.each(familyTypeIds().map((typeId) => [typeId] as const))("%s as drawn from proportions", (typeId) => {
  it.each(VIEWS)("%s view", (view) => {
    expect(renderSvg(draw(designWith(typeId, {}), view))).toMatchSnapshot();
  });
});
