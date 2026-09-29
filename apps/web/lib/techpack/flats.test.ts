import { describe, expect, it } from "vitest";
import { buildFlat } from "@/lib/flat/build";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import { start } from "@/lib/garment/fixtures/specs";
import { resolveMeasurements } from "@/lib/sizing";
import { buildFlatsSection, flatsForTechPack, withCalloutCodes } from "./flats";
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
    const after = measurementTexts(withCalloutCodes(model, calloutCodes(spec)));
    expect(after).toContain("A 52.0 cm");
    for (const text of after) expect(text).toMatch(/^[A-Z]+ \d+\.\d cm$/);
  });

  it("does not change the drawing it is given", () => {
    const spec = scaled();
    const model = flatsForTechPack(spec).front;
    if (!model) throw new Error("no drawing");
    const copy = JSON.stringify(model);
    withCalloutCodes(model, calloutCodes(spec));
    expect(JSON.stringify(model)).toBe(copy);
  });

  it("leaves a drawing with no callout layer as it is", () => {
    const model = flatsForTechPack(start("crew-tee")).front;
    if (!model) throw new Error("no drawing");
    expect(withCalloutCodes(model, [])).toEqual(model);
  });
});

describe("the flats section", () => {
  it("carries both views, with codes in the callouts and a legend that matches the table", () => {
    const spec = scaled();
    const section = buildFlatsSection(spec, flatsForTechPack(spec));
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
    const section = buildFlatsSection(spec, flatsForTechPack(spec));
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
    const section = buildFlatsSection(spec, flatsForTechPack(spec));
    expect(section.views[0]?.description).toMatch(/^Front view\. Crew neck tee/);
    expect(section.views[1]?.description).toMatch(/^Back view\./);
  });
});
