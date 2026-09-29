import { describe, expect, it } from "vitest";
import { POINT_GROUP_LABELS, createSpec, pointsOfMeasureFor, type GarmentSpec } from "@/lib/garment";
import { MADE_UP_CHART_SET, madeUpChart } from "./fixtures/made-up-charts";
import { deepFreeze } from "./fixtures/freeze";
import { MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { gradeChart } from "./grading";
import { resolveMeasurements, type ResolutionRow } from "./resolve";

function crewTee(sizing: GarmentSpec["sizing"], measurements: GarmentSpec["measurements"] = []): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return deepFreeze({ ...made.spec, sizing, measurements });
}

const row = (rows: readonly ResolutionRow[], pointId: string): ResolutionRow => {
  const found = rows.find((entry) => entry.pointId === pointId);
  if (!found) throw new Error(`No row for ${pointId}.`);
  return found;
};

const chartAt = (pointId: string, index: number): number => {
  const chart = madeUpChart("crew-tee", "men");
  const graded = gradeChart(chart, MADE_UP_RUNS[0] ?? { id: "", wearer: "men", sizes: ["a", "b"] });
  if (!graded.ok) throw new Error("Bad chart.");
  return graded.rows.find((entry) => entry.pointId === pointId)?.values[index]?.value ?? 0;
};

const DESIGN = { sizes: ["T2", "T3", "T4", "T9"], baseSize: "T2" } as const;
const set = MADE_UP_CHART_SET;

describe("resolveMeasurements and the sizes of the design", () => {
  it("uses the chart sizes and says so when the design has no sizing", () => {
    const result = resolveMeasurements(crewTee(null), "T3", set);
    expect(result.status === "resolved" && result.sizesFrom).toBe("chart");
    expect(result.status === "resolved" && result.sizes).toEqual(["T1", "T2", "T3", "T4", "T5"]);
    expect(result.status === "resolved" && result.baseSize).toBe("T3");
  });

  it("uses the design sizes and base size when the design has sizing", () => {
    const result = resolveMeasurements(crewTee(DESIGN), "T3", set);
    expect(result.status === "resolved" && result.sizesFrom).toBe("design");
    expect(result.status === "resolved" && result.sizes).toEqual(DESIGN.sizes);
    expect(result.status === "resolved" && result.baseSize).toBe("T2");
  });

  it("refuses a size that is in the chart but not in the design", () => {
    const result = resolveMeasurements(crewTee(DESIGN), "T5", set);
    expect(result.status).toBe("unknown-size");
    expect(result.message).toContain("T2, T3, T4, T9");
  });

  it("takes chart values by size label, whatever the design base size is", () => {
    const result = resolveMeasurements(crewTee(DESIGN), "T4", set);
    expect(row(result.rows, "body-length")).toMatchObject({
      value: chartAt("body-length", 3),
      provenance: "suggested-chart",
    });
  });

  it("gives missing rows with a sentence for a design size the chart does not have", () => {
    const result = resolveMeasurements(crewTee(DESIGN), "T9", set);
    expect(result.status === "resolved" && result.sizesMissingFromChart).toEqual(["T9"]);
    for (const entry of result.rows) {
      expect(entry.status).toBe("missing");
      expect(entry.status === "missing" && entry.message).toContain("T9");
    }
  });

  it("treats a stored value as the value at the design base size", () => {
    const spec = crewTee(DESIGN, [{ pointId: "chest-width", value: 3333, provenance: "brand-supplied" }]);
    expect(row(resolveMeasurements(spec, "T2", set).rows, "chest-width")).toMatchObject({
      value: 3333,
      provenance: "brand-supplied",
      tolerance: 100,
    });
    const atT4 = row(resolveMeasurements(spec, "T4", set).rows, "chest-width");
    expect(atT4).toMatchObject({
      value: 3333 + chartAt("chest-width", 3) - chartAt("chest-width", 1),
      provenance: "derived",
    });
    expect(row(resolveMeasurements(spec, "T9", set).rows, "chest-width").status).toBe("missing");
  });

  it("keeps a value at the design base size even when the chart lacks that size", () => {
    const sizing = { sizes: ["T1", "Q"], baseSize: "Q" };
    const spec = crewTee(sizing, [{ pointId: "chest-width", value: 3000, provenance: "user-edited" }]);
    expect(row(resolveMeasurements(spec, "Q", set).rows, "chest-width")).toMatchObject({
      status: "set",
      value: 3000,
      provenance: "user-edited",
    });
    const other = row(resolveMeasurements(spec, "T1", set).rows, "chest-width");
    expect(other.status).toBe("missing");
    expect(other.status === "missing" && other.message).toContain("Q");
  });
});

describe("resolveMeasurements and sections", () => {
  it("puts a group and a group label on every row, in registry order", () => {
    const spec = crewTee(null);
    const expected = pointsOfMeasureFor(spec);
    for (const result of [resolveMeasurements(spec, "T3", set), resolveMeasurements(spec, "T3", { runs: [], charts: [] })]) {
      expect(result.rows.map((entry) => entry.pointId)).toEqual(expected.map((point) => point.id));
      result.rows.forEach((entry, index) => {
        const group = expected[index]?.group;
        expect(entry.group).toBe(group);
        expect(entry.groupLabel).toBe(group ? POINT_GROUP_LABELS[group] : "");
      });
    }
  });
});
