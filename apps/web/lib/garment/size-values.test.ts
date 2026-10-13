import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { accepted, rejected, setOption, start } from "./fixtures/specs";
import { sizeValueFor, sizeValuesOf, toleranceFor, tolerancesOf } from "./size-values";
import type { GarmentSpec } from "./spec";
import { validateSpec } from "./spec";

const USER = "user-edited";
const sized = (sizes: string[], baseSize: string) => ({ type: "set-sizing", sizing: { sizes, baseSize } });
const atSize = (pointId: string, size: string, value = 5000) => ({
  type: "set-size-measurement",
  entry: { pointId, size, value, provenance: USER },
});
const tolerance = (pointId: string, value = 10) => ({ type: "set-tolerance", entry: { pointId, value, provenance: USER } });

const apply = (spec: GarmentSpec, ...actions: object[]): GarmentSpec =>
  actions.reduce<GarmentSpec>((current, action) => accepted(applyAction(current, action)).spec, spec);

const jersey = () => apply(start("team-jersey"), sized(["S", "M", "L"], "M"));

describe("values typed for other sizes", () => {
  it("are kept for one point at one size, and a second value for the same place replaces the first", () => {
    const spec = apply(jersey(), atSize("chest-width", "L", 5400), atSize("chest-width", "L", 5500), atSize("chest-width", "S"));
    expect(sizeValueFor(spec, "chest-width", "L")).toEqual({ pointId: "chest-width", size: "L", value: 5500, provenance: USER });
    expect(sizeValuesOf(spec)).toHaveLength(2);
  });

  it("are refused for the base size, which keeps its value in the measurement itself", () => {
    expect(rejected(applyAction(jersey(), atSize("chest-width", "M")))).toBe(
      "Size M is the base size. Set Chest width for it in the measurement itself.",
    );
  });

  it("are refused for a size the design does not have", () => {
    expect(rejected(applyAction(jersey(), atSize("chest-width", "XL")))).toBe(
      "The value for Chest width is for size XL, which is not one of the sizes.",
    );
  });

  it("are refused for a point the garment does not have", () => {
    expect(rejected(applyAction(jersey(), atSize("inseam", "L")))).toMatch(/inseam is not a measurement/);
  });

  it("can be removed, and the list goes when it is empty", () => {
    const spec = apply(jersey(), atSize("chest-width", "L"), { type: "remove-size-measurement", pointId: "chest-width", size: "L" });
    expect(spec).not.toHaveProperty("sizeMeasurements");
    expect(rejected(applyAction(spec, { type: "remove-size-measurement", pointId: "chest-width", size: "L" }))).toBe(
      "There is no value of yours for Chest width at size L.",
    );
  });

  it("are removed, and reported, when the sizes change", () => {
    const spec = apply(jersey(), atSize("chest-width", "L"), atSize("chest-width", "S"));
    const result = accepted(applyAction(spec, sized(["S", "M"], "S")));
    expect(sizeValuesOf(result.spec)).toEqual([]);
    expect(result.dropped.map((entry) => entry.message)).toEqual([
      "Your value for Chest width at size L was removed, because the design no longer has that size.",
      "Your value for Chest width at size S was removed, because it is now the base size.",
    ]);
  });

  it("stay when the sizes are cleared, so they come back with the sizes", () => {
    const spec = apply(jersey(), atSize("chest-width", "L"), { type: "set-sizing", sizing: null });
    expect(sizeValuesOf(spec)).toHaveLength(1);
  });

  it("are removed with a point that no longer applies, and reported", () => {
    const spec = apply(jersey(), atSize("shoulder-width", "L"), tolerance("shoulder-width"));
    const result = accepted(applyAction(spec, setOption("sleeve-type", "raglan")));
    expect(result.spec).not.toHaveProperty("sizeMeasurements");
    expect(result.spec).not.toHaveProperty("tolerances");
    expect(result.dropped.map((entry) => entry.message)).toEqual([
      expect.stringMatching(/^Your value for Shoulder width at size L was removed\. /),
      expect.stringMatching(/^Your tolerance for Shoulder width was removed\. /),
    ]);
  });

  it("are refused when listed twice", () => {
    const entry = { pointId: "chest-width", size: "L", value: 5000, provenance: USER };
    const checked = validateSpec({ ...jersey(), sizeMeasurements: [entry, entry] });
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues.join(" ")).toMatch(/Chest width at size L is listed more than once/);
  });
});

describe("tolerances typed by a person", () => {
  it("are kept one for each point, and a new one replaces the old", () => {
    const spec = apply(jersey(), tolerance("chest-width", 10), tolerance("chest-width", 15));
    expect(toleranceFor(spec, "chest-width")).toEqual({ pointId: "chest-width", value: 15, provenance: USER });
    expect(tolerancesOf(spec)).toHaveLength(1);
  });

  it("can be removed, and a second removal says there is nothing to remove", () => {
    const spec = apply(jersey(), tolerance("chest-width"), { type: "remove-tolerance", pointId: "chest-width" });
    expect(spec).not.toHaveProperty("tolerances");
    expect(rejected(applyAction(spec, { type: "remove-tolerance", pointId: "chest-width" }))).toBe(
      "There is no tolerance of yours for Chest width.",
    );
  });

  it("are refused for a point the garment does not have, and when listed twice", () => {
    expect(rejected(applyAction(jersey(), tolerance("inseam")))).toMatch(/inseam is not a measurement/);
    const entry = { pointId: "chest-width", value: 10, provenance: USER };
    const checked = validateSpec({ ...jersey(), tolerances: [entry, entry] });
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues.join(" ")).toMatch(/tolerance for Chest width is listed more than once/);
  });

  it("are read as empty lists from a design saved before they existed", () => {
    expect(sizeValuesOf(start("crew-tee"))).toEqual([]);
    expect(tolerancesOf(start("crew-tee"))).toEqual([]);
  });
});
