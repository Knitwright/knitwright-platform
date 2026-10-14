import { describe, expect, it } from "vitest";
import { TOPS_POINTS_OF_MEASURE } from "@/lib/garment/registry/tops/points-of-measure";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { POINT_LABELS, pointLabel } from "./labels";
import { measurePattern } from "./measure";
import { cmText, measuredTable } from "./table";

const sizeOf = (size: string) => {
  const m = measurePattern(size, JERSEY_EU48.piecesBySize["48"]);
  return { size, measurements: m.measurements, skipped: m.skipped };
};

describe("the labels", () => {
  it("name every registry point and read in plain English", () => {
    for (const point of TOPS_POINTS_OF_MEASURE) expect(POINT_LABELS.some(([id]) => id === point.id)).toBe(true);
    expect(pointLabel("chest-width")).toBe("Chest width");
    expect(pointLabel("something-new")).toBe("something-new");
    expect(new Set(POINT_LABELS.map(([id]) => id)).size).toBe(POINT_LABELS.length);
  });
});

describe("measuredTable", () => {
  it("has a row for each point and a cell for each size, in centimetres", () => {
    const table = measuredTable([sizeOf("48"), { ...sizeOf("50"), measurements: sizeOf("50").measurements.filter((m) => m.pointId !== "hem-width") }]);
    expect(table.sizes).toEqual(["48", "50"]);
    const chest = table.rows.find((r) => r.pointId === "chest-width");
    expect(chest?.cells).toEqual(["50.7", "50.7"]);
    expect(chest?.note).toContain("underarm");
    const hem = table.rows.find((r) => r.pointId === "hem-width");
    expect(hem?.cells).toEqual(["52.0", null]); // 519.5 mm as stored (519.46 mm drawn)
  });

  it("lists points that could not be measured with the reason, and points it has no label for", () => {
    const table = measuredTable([{ size: "M", measurements: [{ pointId: "odd-point", tenthsMm: 1234, method: "How." }], skipped: [{ pointId: "placket-length", reason: "No placket." }] }]);
    expect(table.rows.map((r) => [r.pointId, r.cells, r.note])).toEqual([["placket-length", [null], "No placket."], ["odd-point", ["12.3"], "How."]]);
  });

  it("formats tenths of a millimetre as centimetres", () => {
    expect(cmText(5186)).toBe("51.9");
    expect(cmText(0)).toBe("0.0");
  });
});
