import { describe, expect, it } from "vitest";
import type { MeasurementTable, TableRow } from "@/lib/projects/measurement-table";
import { previewRows, previewTitle } from "./preview";

const row = (patch: Partial<TableRow>): TableRow => ({
  pointId: "chest-width",
  label: "Chest width",
  howToMeasure: "Across the chest.",
  hasValue: true,
  valueCm: "52.0",
  valueTenths: 5200,
  isOwn: false,
  tolerance: "1.0 cm",
  provenanceLabel: "From the size chart",
  tone: null,
  message: null,
  canResetToChart: false,
  ...patch,
});

const table = (rows: readonly TableRow[], size = "M"): MeasurementTable => ({
  size,
  notice: null,
  groups: [{ group: "body", label: "Body", rows }],
});

describe("the measurements beside the drawing", () => {
  it("shows every value in centimetres, with where it came from", () => {
    expect(previewRows(table([row({})]), "cm")).toEqual([
      { pointId: "chest-width", label: "Chest width", value: "52.0 cm", source: "From the size chart" },
    ]);
  });

  it("shows the same values in inches when asked, without changing the design", () => {
    expect(previewRows(table([row({})]), "in")[0]?.value).toBe("20 1/2 in");
  });

  it("says a missing value is still to be given, never a zero", () => {
    const missing = row({ hasValue: false, valueCm: "", valueTenths: null, provenanceLabel: null });
    expect(previewRows(table([missing]), "in")[0]).toMatchObject({ value: "Not given yet", source: null });
  });

  it("names the size the values are for, in plain words", () => {
    expect(previewTitle(table([], "M"))).toBe("Measurements for size M");
    expect(previewTitle(table([], ""))).toBe("Measurements");
  });
});
