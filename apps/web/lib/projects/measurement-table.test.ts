import { describe, expect, it } from "vitest";
import { applyAction, pointsOfMeasureFor, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { sizingFromChart } from "@/lib/sizing";
import { MADE_UP_CHART_SET } from "@/lib/sizing/fixtures/made-up-charts";
import { measurementTable, type TableRow } from "./measurement-table";

const apply = (spec: GarmentSpec, action: unknown): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const withChartSizes = (spec: GarmentSpec): GarmentSpec => {
  const made = sizingFromChart(spec, MADE_UP_CHART_SET);
  if (!made.ok) throw new Error(made.reason);
  return apply(spec, made.action);
};

const typed = (spec: GarmentSpec, pointId: string, value: number, provenance = "user-edited"): GarmentSpec =>
  apply(spec, { type: "set-measurement", pointId, value, provenance });

const rowsOf = (table: ReturnType<typeof measurementTable>): TableRow[] => table.groups.flatMap((group) => group.rows);

const row = (table: ReturnType<typeof measurementTable>, pointId: string): TableRow => {
  const found = rowsOf(table).find((entry) => entry.pointId === pointId);
  if (!found) throw new Error(`No row for ${pointId}.`);
  return found;
};

describe("measurementTable with no size chart", () => {
  it("has a row for every point that applies, all missing, with an empty value", () => {
    const spec = start("crew-tee", "women");

    const table = measurementTable(spec);

    expect(rowsOf(table).map((entry) => entry.pointId).sort()).toEqual(pointsOfMeasureFor(spec).map((point) => point.id).sort());
    for (const entry of rowsOf(table)) {
      expect(entry).toMatchObject({ hasValue: false, valueCm: "", provenanceLabel: null, tone: null, canResetToChart: false });
      expect(entry.message).toBe("No value yet. Type one in.");
      expect(entry.howToMeasure.length).toBeGreaterThan(20);
    }
  });

  it("says once that no chart applies, and asks for no size", () => {
    const table = measurementTable(start("crew-tee", "women"));

    expect(table.notice).toBe(
      "There is no size chart yet for Crew neck tee for women. Nothing is filled in for you, so type each measurement in.",
    );
    expect(table.size).toBe("");
  });

  it("groups the rows into sections with their names, in a fixed order", () => {
    const table = measurementTable(start("polo", "men"));

    expect(table.groups.map((group) => group.label)).toEqual(["Body", "Sleeve", "Neck and collar", "Placket"]);
    expect(table.groups.every((group) => group.rows.length > 0)).toBe(true);
  });

  it("leaves out a section that has no rows", () => {
    const table = measurementTable(start("crew-tee", "women"));

    expect(table.groups.map((group) => group.label)).not.toContain("Placket");
  });

  it("shows a typed value in centimetres, with its source in plain words", () => {
    const spec = typed(start("crew-tee", "women"), "chest-width", 5250);

    const entry = row(measurementTable(spec), "chest-width");

    expect(entry).toMatchObject({
      hasValue: true,
      valueCm: "52.5",
      provenanceLabel: "Typed in by you",
      tone: "person",
      tolerance: "To be confirmed",
      canResetToChart: false,
    });
  });

  it("shows the words of the supplier for a brand's own value", () => {
    const spec = typed(start("crew-tee", "women"), "chest-width", 5250, "brand-supplied");

    expect(row(measurementTable(spec), "chest-width")).toMatchObject({
      provenanceLabel: "Supplied by your brand",
      tone: "person",
    });
  });

  it("styles a value from the assistant as a suggestion, never as a person's", () => {
    const spec = typed(start("crew-tee", "women"), "chest-width", 5250, "ai-suggested");

    expect(row(measurementTable(spec), "chest-width")).toMatchObject({
      provenanceLabel: "Suggested by the assistant",
      tone: "suggested",
    });
  });
});

describe("measurementTable with a size chart", () => {
  it("fills every row from the chart at the base size, marked as suggested", () => {
    const spec = withChartSizes(start("crew-tee", "women"));

    const table = measurementTable(spec, MADE_UP_CHART_SET);

    expect(table.notice).toContain("fit");
    expect(table.size).toBe(spec.sizing?.baseSize);
    for (const entry of rowsOf(table)) {
      expect(entry).toMatchObject({
        hasValue: true,
        provenanceLabel: "Suggested from a size chart",
        tone: "suggested",
        tolerance: "±1 cm",
        canResetToChart: false,
      });
      expect(Number(entry.valueCm)).toBeGreaterThan(0);
    }
  });

  it("lets the person put a value they typed back to the chart", () => {
    const spec = typed(withChartSizes(start("crew-tee", "women")), "chest-width", 5250);

    const table = measurementTable(spec, MADE_UP_CHART_SET);

    expect(row(table, "chest-width")).toMatchObject({ valueCm: "52.5", tone: "person", canResetToChart: true });
    expect(row(table, "body-length").canResetToChart).toBe(false);
  });

  it("uses the chart's base size when the design has no sizes yet", () => {
    const spec = start("crew-tee", "women");

    const table = measurementTable(spec, MADE_UP_CHART_SET);

    expect(table.size).toBe("U3");
    expect(row(table, "chest-width").hasValue).toBe(true);
  });

  it("shows every row as missing, with the reason, when the chart has none of the design's sizes", () => {
    const spec = apply(start("crew-tee", "women"), {
      type: "set-sizing",
      sizing: { sizes: ["S", "M"], baseSize: "M" },
    });

    const table = measurementTable(spec, MADE_UP_CHART_SET);

    expect(table.size).toBe("M");
    for (const entry of rowsOf(table)) {
      expect(entry).toMatchObject({ hasValue: false, valueCm: "" });
      expect(entry.message).toContain("size M");
    }
  });

  it("never gives a zero for a value that is missing", () => {
    const table = measurementTable(start("crew-tee", "women"));

    expect(rowsOf(table).some((entry) => entry.valueCm === "0")).toBe(false);
  });
});
