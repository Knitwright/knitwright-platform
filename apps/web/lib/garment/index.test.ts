import { describe, expect, it } from "vitest";
import * as garment from "./index";

describe("garment public surface", () => {
  it("lets a caller make, change and check a design using only the index", () => {
    const created = garment.createSpec("v-neck-tee", "youth");
    if (!created.ok) throw new Error(created.reason);
    const cm = garment.cmToTenthsMm(52.5);
    const changed = garment.applyAction(created.spec, {
      type: "set-measurement",
      pointId: "chest-width",
      value: cm,
      provenance: "user-edited",
    });
    expect(changed.ok).toBe(true);
    expect(garment.validateSpec(changed.ok ? changed.spec : null).ok).toBe(true);
    expect(garment.pointsOfMeasureFor(created.spec)).toHaveLength(11);
    expect(garment.panelsFor(created.spec)).toHaveLength(5);
    expect(garment.checkCombination("v-neck-tee", created.spec.options)).toEqual([]);
    expect(garment.formatCm(5250)).toBe("52.5");
  });
});
