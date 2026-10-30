import { describe, expect, it } from "vitest";
import { LAYERS, type FlatModel } from "@/lib/flat/model";
import { CHARTS, fullDesign, packFor } from "../fixtures/designs";
import { drawingsFor, monochrome, withoutCallouts } from "./flat-views";

const pack = packFor(fullDesign("crew-tee"), { charts: CHARTS });

const front = (): FlatModel => {
  const model = pack.flats.views.find((view) => view.view === "front")?.model;
  if (!model) throw new Error("The fixture has no front drawing.");
  return model;
};

const colours = (model: FlatModel): readonly string[] => [
  ...new Set(
    model.layers.flatMap((layer) =>
      layer.elements.flatMap((element) => {
        if (element.kind === "text") return [element.colour];
        if (element.kind !== "path") return [];
        return [...(element.fill === null ? [] : [element.fill]), ...(element.stroke === null ? [] : [element.stroke.colour])];
      }),
    ),
  ),
];

describe("the drawing with no colour in it, for the technical flats page", () => {
  it("leaves only black and white, and keeps every element", () => {
    const model = front();
    const mono = monochrome(model);
    expect(colours(model).length).toBeGreaterThan(2);
    expect(colours(mono).every((colour) => colour === "#000000" || colour === "#ffffff")).toBe(true);
    expect(mono.layers.map((layer) => layer.elements.length)).toEqual(model.layers.map((layer) => layer.elements.length));
  });

  it("never changes the drawing it was given, so the colour pages still have their colours", () => {
    const model = front();
    const before = JSON.stringify(model);
    monochrome(model);
    expect(JSON.stringify(model)).toBe(before);
  });

  it("keeps a path that has no fill unfilled, rather than filling it white", () => {
    const model = front();
    const unfilled = model.layers.flatMap((layer) => layer.elements).filter((element) => element.kind === "path" && element.fill === null);
    expect(unfilled.length).toBeGreaterThan(0);
    const after = monochrome(model).layers.flatMap((layer) => layer.elements).filter((element) => element.kind === "path" && element.fill === null);
    expect(after.length).toBe(unfilled.length);
  });
});

describe("the drawing without its callout marks", () => {
  it("drops the measurements layer and keeps the rest", () => {
    const model = front();
    expect(model.layers.map((layer) => layer.id)).toContain(LAYERS.measurements.id);
    const without = withoutCallouts(model);
    expect(without.layers.map((layer) => layer.id)).not.toContain(LAYERS.measurements.id);
    expect(without.layers.length).toBe(model.layers.length - 1);
  });
});

describe("what each page draws", () => {
  const ids = (views: ReturnType<typeof drawingsFor>): readonly (readonly string[])[] =>
    views.map((view) => (view.model?.layers ?? []).map((layer) => layer.id));

  it("gives the technical flats page two views with no callouts and no colour", () => {
    const views = drawingsFor("flats-mono", pack);
    expect(views.map((view) => view.view)).toEqual(["front", "back"]);
    for (const layers of ids(views)) expect(layers).not.toContain(LAYERS.measurements.id);
    for (const view of views) if (view.model) expect(colours(view.model).every((colour) => colour === "#000000" || colour === "#ffffff")).toBe(true);
  });

  it("gives the colour views page the same two views in colour, without callouts", () => {
    const views = drawingsFor("flats-colour", pack);
    expect(views.map((view) => view.view)).toEqual(["front", "back"]);
    for (const layers of ids(views)) expect(layers).not.toContain(LAYERS.measurements.id);
    const front = views[0]?.model;
    expect(front && colours(front).length).toBeGreaterThan(2);
  });

  it("gives the annotations page the drawings the document built, marks and all", () => {
    expect(drawingsFor("flats-callouts", pack)).toEqual(pack.flats.views);
  });

  it("gives the colourways page one front for each colourway", () => {
    expect(drawingsFor("colourway-fronts", pack).map((view) => view.label)).toEqual(["Home, front", "Away, front"]);
  });

  it("gives no drawing to the pictures page or to a page with none", () => {
    expect(drawingsFor("illustrations", pack)).toEqual([]);
    expect(drawingsFor(null, pack)).toEqual([]);
  });
});
