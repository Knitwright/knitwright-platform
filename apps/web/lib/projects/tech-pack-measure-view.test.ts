import { describe, expect, it } from "vitest";
import { TO_BE_CONFIRMED, type LengthValue, type MeasureRow, type SizeColumn } from "@/lib/techpack";
import { measureHeads, measureRowView } from "./tech-pack-measure-view";

const length = (value: string, provenance: "user-edited" | "suggested-chart" | "derived"): LengthValue => ({
  status: "set",
  value,
  tenthsMm: Math.round(Number(value) * 100),
  provenance,
});
const TBC = { status: "to-be-confirmed" } as const;

const COLUMNS: readonly SizeColumn[] = [
  { size: "S", label: "S", isBase: false },
  { size: "M", label: "M", isBase: true },
  { size: "L", label: "L", isBase: false },
];

const row = (values: readonly LengthValue[], tolerance: LengthValue): MeasureRow => ({
  pointId: "chest-width",
  code: "A",
  label: "Chest width",
  tolerance,
  values,
  notes: [],
});

describe("the compact measurement table", () => {
  it("heads each size column, marking the base size", () => {
    expect(measureHeads(COLUMNS)).toEqual([
      { label: "S", isBase: false, phone: "S" },
      { label: "M", isBase: true, phone: "M (base size)" },
      { label: "L", isBase: false, phone: "L" },
    ]);
  });

  it("shows each value as a number in centimetres, with its tone, and marks the base column", () => {
    const view = measureRowView(row([length("50.0", "suggested-chart"), length("52.5", "user-edited"), TBC], length("±1.0", "suggested-chart")), COLUMNS);
    expect(view.cells).toEqual([
      { text: "50.0", tone: "suggested", isBase: false, source: "Suggested from a size chart" },
      { text: "52.5", tone: "person", isBase: true, source: "Typed in by you" },
      { text: TO_BE_CONFIRMED, tone: "missing", isBase: false, source: null },
    ]);
    expect(view.tolerance).toEqual({ text: "±1.0", tone: "suggested", isBase: false, source: "Suggested from a size chart" });
  });

  it("names every source of the row once, in the order they first appear", () => {
    const view = measureRowView(row([length("50.0", "suggested-chart"), length("52.5", "user-edited"), length("55.0", "suggested-chart")], length("1.0", "user-edited")), COLUMNS);
    expect(view.sources).toEqual(["Suggested from a size chart", "Typed in by you"]);
  });

  it("names no source for a row with nothing filled in", () => {
    expect(measureRowView(row([TBC, TBC, TBC], TBC), COLUMNS).sources).toEqual([]);
  });
});
