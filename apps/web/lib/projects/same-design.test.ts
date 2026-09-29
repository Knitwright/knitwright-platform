import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { deepEqual, sameDesign } from "./same-design";

const measure = (spec: GarmentSpec, pointId: string, value: number): GarmentSpec => {
  const result = applyAction(spec, { type: "set-measurement", pointId, value, provenance: "user-edited" });
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("deepEqual", () => {
  it("ignores the order of keys but not the order of list entries", () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });

  it("tells values, nulls, missing keys and types apart", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: null }, { a: undefined })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual("1", 1)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(1, 1)).toBe(true);
  });
});

describe("sameDesign", () => {
  it("is true for the same design", () => {
    expect(sameDesign(start("crew-tee"), start("crew-tee"))).toBe(true);
  });

  it("does not care in which order the measurements were added", () => {
    const one = measure(measure(start("crew-tee"), "chest-width", 5000), "body-length", 7000);
    const other = measure(measure(start("crew-tee"), "body-length", 7000), "chest-width", 5000);

    expect(sameDesign(one, other)).toBe(true);
    expect(JSON.stringify(one)).not.toBe(JSON.stringify(other));
  });

  it("notices a different value or a different source", () => {
    const base = measure(start("crew-tee"), "chest-width", 5000);

    expect(sameDesign(base, measure(start("crew-tee"), "chest-width", 5100))).toBe(false);
    const other = { ...base, measurements: [{ ...base.measurements[0], provenance: "brand-supplied" }] } as GarmentSpec;
    expect(sameDesign(base, other)).toBe(false);
  });

  it("does not care in which order fabric assignments were made", () => {
    const base = start("crew-tee");
    const one = { ...base, panelFabrics: [{ panelId: "body-front", fabricId: "main" }, { panelId: "body-back", fabricId: "main" }] } as GarmentSpec;
    const two = { ...base, panelFabrics: [{ panelId: "body-back", fabricId: "main" }, { panelId: "body-front", fabricId: "main" }] } as GarmentSpec;

    expect(sameDesign(one, two)).toBe(true);
  });
});
