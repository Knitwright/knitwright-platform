import { describe, expect, it } from "vitest";
import type { FlatModel } from "@/lib/flat/model";
import { buildFlat } from "@/lib/flat/build";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import { applyAction } from "@/lib/garment";
import { CHARTS } from "./fixtures/charts";
import { start } from "@/lib/garment/fixtures/specs";
import { resolveAllSizes, resolveMeasurements } from "@/lib/sizing";
import { buildFlatsSection, calloutValues, flatsForTechPack, withCalloutCodes } from "./flats";
import { calloutCodes } from "./codes";

const scaled = () => designWith("crew-tee", {}, madeUpForType("crew-tee", {}));
const layerIds = (model: { layers: readonly { id: string }[] } | null): string[] => (model?.layers ?? []).map((layer) => layer.id);
const measurementTexts = (model: NonNullable<ReturnType<typeof flatsForTechPack>["front"]>): string[] =>
  model.layers
    .filter((layer) => layer.id === "measurements")
    .flatMap((layer) => layer.elements)
    .flatMap((element) => (element.kind === "text" ? [element.text] : []));

describe("flatsForTechPack", () => {
  it("draws the front and the back with callouts, from the measurements the table shows", () => {
    const flats = flatsForTechPack(scaled());
    expect(flats.front?.toScale).toBe(true);
    expect(flats.back?.toScale).toBe(true);
    expect(layerIds(flats.front)).toContain("measurements");
    expect(layerIds(flats.back)).toContain("measurements");
  });

  it("draws a new design not to scale, with no callout layer", () => {
    const flats = flatsForTechPack(start("crew-tee"));
    expect(flats.front?.toScale).toBe(false);
    expect(layerIds(flats.front)).not.toContain("measurements");
  });

  it("draws the first colourway", () => {
    expect(flatsForTechPack(start("crew-tee")).front?.colourwayId).toBe("main");
  });

  it("gives nothing for a type that has no drawing", () => {
    expect(flatsForTechPack({ ...start("crew-tee"), typeId: "kilt" })).toEqual({ front: null, back: null });
  });

  it("uses the same measurements as a drawing made by hand at the base size", () => {
    const spec = scaled();
    const by = buildFlat({ spec, measurements: resolveMeasurements(spec, ""), view: "front", colourwayId: "main", callouts: true });
    expect(flatsForTechPack(spec).front).toEqual(by);
  });
});

describe("withCalloutCodes", () => {
  it("replaces each label with the short code and keeps the value", () => {
    const spec = scaled();
    const model = flatsForTechPack(spec).front;
    if (!model) throw new Error("no drawing");
    const before = measurementTexts(model);
    expect(before.some((text) => text.startsWith("Chest width "))).toBe(true);
    const after = measurementTexts(withCalloutCodes(model, calloutCodes(spec), calloutValues(spec)));
    expect(after).toContain("A 52.0 cm");
    for (const text of after) expect(text).toMatch(/^[A-Z]+ \d+\.\d cm$/);
  });

  it("does not change the drawing it is given", () => {
    const spec = scaled();
    const model = flatsForTechPack(spec).front;
    if (!model) throw new Error("no drawing");
    const copy = JSON.stringify(model);
    withCalloutCodes(model, calloutCodes(spec), calloutValues(spec));
    expect(JSON.stringify(model)).toBe(copy);
  });

  it("leaves a drawing with no callout layer as it is", () => {
    const model = flatsForTechPack(start("crew-tee")).front;
    if (!model) throw new Error("no drawing");
    expect(withCalloutCodes(model, [], new Map())).toEqual(model);
  });
});

describe("callout codes, matched by point", () => {
  const text = (value: string) =>
    ({ kind: "text", text: value, at: { x: 0, y: 0 }, size: 1, anchor: "start", colour: "#000000", rotation: 0 }) as const;
  const model = {
    layers: [{ id: "measurements", label: "Measurements", elements: [text("Neck 1.0 cm"), text("Neck width 2.0 cm")] }],
  } as unknown as FlatModel;
  const codes = [
    { pointId: "neck", code: "A", label: "Neck" },
    { pointId: "neck-width", code: "B", label: "Neck width" },
  ];

  it("gives each callout the code of its own point, even when one label starts with another", () => {
    const coded = withCalloutCodes(model, codes, new Map([["neck", 100], ["neck-width", 200]]));
    expect(coded.layers[0]?.elements.map((element) => (element.kind === "text" ? element.text : ""))).toEqual([
      "A 1.0 cm",
      "B 2.0 cm",
    ]);
  });

  it("leaves a callout alone when its value is not the one drawn for the point", () => {
    const coded = withCalloutCodes(model, codes, new Map([["neck", 999], ["neck-width", 200]]));
    expect(coded.layers[0]?.elements.map((element) => (element.kind === "text" ? element.text : ""))).toEqual([
      "Neck 1.0 cm",
      "B 2.0 cm",
    ]);
  });
});

describe("the drawing is made for the base size and the colourway asked for", () => {
  it("draws the callouts with the values of the base size, which are the values of the table", () => {
    const spec = scaled();
    const texts = measurementTexts(flatsForTechPack(spec, CHARTS).front as NonNullable<FlatModel>);
    const table = resolveAllSizes(spec, CHARTS);
    const rowAt = (isBase: boolean) =>
      table.entries.find((entry) => entry.isBase === isBase)?.resolution.rows.find((row) => row.pointId === "chest-width");
    const base = rowAt(true);
    const other = rowAt(false);
    if (base?.status !== "set" || other?.status !== "set") throw new Error("no chest width");
    expect(base.value).not.toBe(other.value);
    expect(texts).toContain(`Chest width ${(base.value / 100).toFixed(1)} cm`);
    expect(texts).not.toContain(`Chest width ${(other.value / 100).toFixed(1)} cm`);
  });

  it("draws the colourway that was asked for", () => {
    const withAway = applyAction(start("crew-tee"), {
      type: "add-colourway",
      colourway: { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "White", swatch: "#ffffff", provenance: "user-edited" }] },
    });
    if (!withAway.ok) throw new Error(withAway.reason);
    expect(flatsForTechPack(withAway.spec, undefined, "away").front?.colourwayId).toBe("away");
    expect(flatsForTechPack(withAway.spec, undefined, "main").front?.colourwayId).toBe("main");
    expect(flatsForTechPack(withAway.spec).front?.colourwayId).toBe("main");
    expect(flatsForTechPack(withAway.spec, undefined, "nope").front?.colourwayId).toBe("main");
  });
});

describe("the flats section", () => {
  it("carries both views, with codes in the callouts and a legend that matches the table", () => {
    const spec = scaled();
    const section = buildFlatsSection(spec, flatsForTechPack(spec), undefined);
    expect(section.id).toBe("flats");
    expect(section.title).toBe("Flats with callouts");
    expect(section.views.map((view) => view.label)).toEqual(["Front", "Back"]);
    expect(section.callouts.map((entry) => entry.code).slice(0, 2)).toEqual(["A", "B"]);
    expect(section.callouts.map((entry) => entry.pointId)).toEqual(calloutCodes(spec).map((entry) => entry.pointId));
    for (const view of section.views) {
      expect(view.toScale).toBe(true);
      expect(view.model && measurementTexts(view.model).length).toBeGreaterThan(0);
      for (const text of view.model ? measurementTexts(view.model) : []) expect(text).not.toMatch(/Chest|Body|Sleeve|Neck/);
    }
    expect(section.note).toBeNull();
  });

  it("says when the drawing is not to scale, and carries no callout values", () => {
    const spec = start("crew-tee");
    const section = buildFlatsSection(spec, flatsForTechPack(spec), undefined);
    expect(section.callouts).toEqual([]);
    expect(section.note).toBe("Not to scale. Some measurements are missing. The drawing carries no measurement values.");
    for (const view of section.views) {
      expect(view.toScale).toBe(false);
      expect(layerIds(view.model)).not.toContain("measurements");
      expect(view.notice).toBe("Not to scale. Some measurements are missing.");
    }
  });

  it("takes the callout layer out of a drawing that says it is not to scale, even if it holds one", () => {
    const spec = scaled();
    const model = flatsForTechPack(spec).front;
    if (!model) throw new Error("no drawing");
    const section = buildFlatsSection(spec, { front: { ...model, toScale: false, notice: "Not to scale." }, back: null });
    expect(layerIds(section.views[0]?.model ?? null)).not.toContain("measurements");
    expect(section.callouts).toEqual([]);
  });

  it("says so when a garment type has no drawing", () => {
    const section = buildFlatsSection(start("crew-tee"), { front: null, back: null });
    expect(section.views.every((view) => view.model === null && !view.toScale)).toBe(true);
    expect(section.views[0]?.notice).toBe("There is no drawing for this garment type yet.");
    expect(section.note).toBe("There is no drawing for this garment type yet.");
  });

  it("describes each view in words", () => {
    const spec = start("crew-tee");
    const section = buildFlatsSection(spec, flatsForTechPack(spec), undefined);
    expect(section.views[0]?.description).toMatch(/^Front view\. Crew neck tee/);
    expect(section.views[1]?.description).toMatch(/^Back view\./);
  });
});
