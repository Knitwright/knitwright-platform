import { describe, expect, it } from "vitest";
import type { FabricProfile, FabricValue } from "@/lib/production/contract";
import { buildFabric } from "./fabric";

const NOT_SET: FabricValue = { value: null, source: "not-set" };
const tested = (value: number): FabricValue => ({ value, source: "fabric-test", testId: "T-1" });

const FABRIC: FabricProfile = {
  stretchLengthPct: tested(30),
  stretchWidthPct: tested(40),
  recoveryPct: tested(95),
  shrinkLengthPct: tested(2),
  shrinkWidthPct: tested(1.5),
  gsm: { value: 180, source: "supplier-sheet" },
  usableWidthMm: { value: 1500, source: "suggested" },
};

describe("the fabric section", () => {
  it("says no fabric has been tested when there is none, and scales nothing", () => {
    const empty = buildFabric(null, null);
    expect(empty.note).toMatch(/^No fabric has been tested yet/);
    expect(empty.rows.every((row) => row.measure.status === "to-be-confirmed")).toBe(true);
    expect(empty.printScaleLength).toEqual({ status: "to-be-confirmed" });
    expect(empty.printScaleNote).toBe("Not scaled for shrink: this fabric has no shrink test.");
    expect(empty.reductionNote).toBe("The pattern does not say how much it was reduced for stretch.");
  });

  it("gives each value with its source, a test by its id", () => {
    const rows = Object.fromEntries(buildFabric(FABRIC, null).rows.map((row) => [row.id, row]));
    expect(rows["stretch-length"]).toMatchObject({ measure: { number: 30, value: "30 %", provenance: "brand-supplied" }, sourceNote: "From fabric test T-1" });
    expect(rows["gsm"]).toMatchObject({ measure: { value: "180 gsm" }, sourceNote: "From the supplier's sheet" });
    expect(rows["usable-width"]).toMatchObject({ measure: { provenance: "suggested-chart" }, sourceNote: "Suggested, not tested" });
  });

  it("works out the print scale from the tested shrink", () => {
    const fabric = buildFabric(FABRIC, null);
    expect(fabric.printScaleLength).toMatchObject({ value: "1.0204", number: 1.0204, unit: "times", provenance: "derived" });
    expect(fabric.printScaleWidth).toMatchObject({ value: "1.0152" });
    expect(fabric.printScaleNote).toMatch(/^Artwork is printed this much larger/);
  });

  it("does not scale from a suggested shrink", () => {
    const fabric = buildFabric({ ...FABRIC, shrinkLengthPct: { value: 2, source: "suggested" } }, null);
    expect(fabric.printScaleLength).toEqual({ status: "to-be-confirmed" });
    expect(fabric.printScaleNote).toBe("Not scaled for shrink: this fabric has no shrink test.");
  });

  it("names a test without an id by its source alone", () => {
    const rows = buildFabric({ ...FABRIC, recoveryPct: { value: 95, source: "fabric-test" } }, null).rows;
    expect(rows.find((row) => row.id === "recovery")?.sourceNote).toBe("From a fabric test");
    expect(buildFabric({ ...FABRIC, recoveryPct: NOT_SET }, null).rows.find((row) => row.id === "recovery")?.sourceNote).toBe("Not set");
  });

  it("sets the pattern's reduction beside the tested stretch", () => {
    expect(buildFabric(FABRIC, { lengthPct: 30, widthPct: 40 }).reductionNote).toBe(
      "The pattern was reduced by 30 % along the length and 40 % across. The fabric test gives a stretch of 30 % along the length and 40 % across.",
    );
    expect(buildFabric(null, { lengthPct: 30, widthPct: 40 }).reductionNote).toMatch(/There is no fabric test to compare it with\.$/);
    expect(buildFabric({ ...FABRIC, stretchWidthPct: NOT_SET }, { lengthPct: 1, widthPct: 2 }).reductionNote).toMatch(/no fabric test/);
  });
});
