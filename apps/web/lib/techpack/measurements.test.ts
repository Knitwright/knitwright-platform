import { describe, expect, it } from "vitest";
import { designWith } from "@/lib/flat/fixtures/designs";
import { applyAction, getType } from "@/lib/garment";
import { accepted, start } from "@/lib/garment/fixtures/specs";
import { resolveAllSizes } from "@/lib/sizing";
import { pointsInTableOrder } from "./codes";
import { buildHowToMeasure, buildMeasurements } from "./measurements";
import { CHARTS } from "./fixtures/charts";
import { NO_CHART_SET } from "@/lib/sizing/fixtures/no-charts";
import type { LengthValue, MeasureRow } from "./types";

const rowOf = (rows: readonly MeasureRow[], pointId: string): MeasureRow => {
  const found = rows.find((row) => row.pointId === pointId);
  if (!found) throw new Error(`No row for ${pointId}`);
  return found;
};

const allRows = (section: ReturnType<typeof buildMeasurements>): MeasureRow[] =>
  section.groups.flatMap((group) => group.rows);

const valueTexts = (values: readonly LengthValue[]): string[] =>
  values.map((value) => (value.status === "set" ? value.value : "TBC"));

const typed = (pointId: string, value: number) =>
  accepted(
    applyAction(designWith("crew-tee", {}), { type: "set-measurement", pointId, value, provenance: "user-edited" }),
  ).spec;

describe("the measurement table with a size chart", () => {
  const spec = designWith("crew-tee", {});
  const section = buildMeasurements(spec, CHARTS);

  it("has a column for each size of the run, the base size marked", () => {
    expect(section.columns.map((column) => column.size)).toEqual(["U1", "U2", "U3", "U4"]);
    expect(section.columns.map((column) => column.isBase)).toEqual([false, false, true, false]);
    expect(section.sizesFrom).toBe("chart");
  });

  it("has a row for each point of measure, grouped by section and in registry order inside each", () => {
    const expected = pointsInTableOrder(spec).map((point) => point.id);
    expect(allRows(section).map((row) => row.pointId)).toEqual(expected);
    expect(section.groups.map((group) => group.label)).toEqual(["Body", "Sleeve", "Neck and collar"]);
  });

  it("gives each row a code in table order", () => {
    expect(allRows(section).map((row) => row.code)).toEqual("ABCDEFGHIJK".split(""));
  });

  it("writes each value in centimetres with its source, and keeps the stored number", () => {
    const chest = rowOf(allRows(section), "chest-width");
    expect(valueTexts(chest.values)).toEqual(["18.0", "19.0", "20.0", "21.0"]);
    expect(chest.values[2]).toEqual({ status: "set", value: "20.0", tenthsMm: 2000, provenance: "suggested-chart" });
  });

  it("gives the tolerance with the chart as its source", () => {
    const chest = rowOf(allRows(section), "chest-width");
    expect(chest.tolerance).toEqual({ status: "set", value: "±1.0", tenthsMm: 100, provenance: "suggested-chart" });
  });

  it("agrees with the sizing library for every size and every point", () => {
    const all = resolveAllSizes(spec, CHARTS);
    for (const [column, entry] of all.entries.entries()) {
      for (const source of entry.resolution.rows) {
        const cell = rowOf(allRows(section), source.pointId).values[column];
        if (source.status === "set") {
          expect(cell).toMatchObject({ status: "set", tenthsMm: source.value, provenance: source.provenance });
        } else {
          expect(cell).toEqual({ status: "to-be-confirmed" });
        }
      }
    }
  });

  it("shows a value the user typed as theirs at the base size and as worked out at the others", () => {
    const row = rowOf(allRows(buildMeasurements(typed("chest-width", 5200), CHARTS)), "chest-width");
    expect(row.values[2]).toMatchObject({ value: "52.0", provenance: "user-edited" });
    expect(row.values[1]).toMatchObject({ value: "51.0", provenance: "derived" });
  });
});

describe("the measurement table without a size chart", () => {
  const sized = accepted(
    applyAction(designWith("crew-tee", {}), { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } }),
  ).spec;
  const withChest = accepted(
    applyAction(sized, { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" }),
  ).spec;

  it("shows the typed value at the base size and to be confirmed at the others, never a zero", () => {
    const section = buildMeasurements(withChest, NO_CHART_SET);
    const chest = rowOf(allRows(section), "chest-width");
    expect(valueTexts(chest.values)).toEqual(["TBC", "52.5", "TBC"]);
    expect(chest.values[0]).toEqual({ status: "to-be-confirmed" });
    expect(section.columns.map((column) => column.isBase)).toEqual([false, true, false]);
    expect(section.sizesFrom).toBe("design");
  });

  it("marks a tolerance nobody has entered as to be confirmed", () => {
    expect(rowOf(allRows(buildMeasurements(withChest, NO_CHART_SET)), "chest-width").tolerance).toEqual({
      status: "to-be-confirmed",
    });
  });

  it("explains a missing value in the notes of its row", () => {
    const notes = rowOf(allRows(buildMeasurements(withChest, NO_CHART_SET)), "chest-width").notes;
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.join(" ")).toMatch(/size chart/i);
  });

  it("says once for all the sizes what it would otherwise say for each size in turn", () => {
    const five = accepted(
      applyAction(withChest, { type: "set-sizing", sizing: { sizes: ["XS", "S", "M", "L", "XL"], baseSize: "M" } }),
    ).spec;
    const notes = rowOf(allRows(buildMeasurements(five)), "chest-width").notes;
    expect(notes).toEqual([
      "Chest width was typed in for size M. With no size chart it cannot be worked out for sizes XS, S, L and XL. Type a value for these sizes.",
      "No size chart applies, so this is the value that was typed in for size M, with no tolerance.",
    ]);
  });

  it("keeps a note for one size as it is", () => {
    const two = accepted(applyAction(withChest, { type: "set-sizing", sizing: { sizes: ["M", "L"], baseSize: "M" } })).spec;
    expect(rowOf(allRows(buildMeasurements(two)), "chest-width").notes).toEqual([
      "No size chart applies, so this is the value that was typed in for size M, with no tolerance.",
      "Chest width was typed in for size M. With no size chart it cannot be worked out for size L. Type a value for this size.",
    ]);
  });

  it("says a note that names no size once", () => {
    const notes = rowOf(allRows(buildMeasurements(withChest)), "body-length").notes;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^Body length has no value\./);
  });

  it("has only to be confirmed cells for a point with nothing typed", () => {
    const row = rowOf(allRows(buildMeasurements(withChest, NO_CHART_SET)), "body-length");
    expect(row.values.every((value) => value.status === "to-be-confirmed")).toBe(true);
  });

  it("says which values are missing in the note of the section", () => {
    expect(buildMeasurements(withChest, NO_CHART_SET).note).toBe("Some measurements are still to be confirmed.");
  });

  it("holds no zero anywhere a value is missing", () => {
    const text = JSON.stringify(buildMeasurements(withChest, NO_CHART_SET).groups);
    expect(text).not.toMatch(/"tenthsMm":0[,}]/);
    expect(text).not.toMatch(/"value":"0\.0"/);
  });
});

describe("the measurement table with no sizes at all", () => {
  it("has one column that says the size is not set, and every value to be confirmed", () => {
    const section = buildMeasurements(start("crew-tee"), NO_CHART_SET);
    expect(section.columns).toEqual([{ size: null, label: "Size not set", isBase: false }]);
    expect(section.sizesFrom).toBeNull();
    expect(allRows(section)).toHaveLength(11);
    for (const row of allRows(section)) {
      expect(row.values).toEqual([{ status: "to-be-confirmed" }]);
      expect(row.tolerance).toEqual({ status: "to-be-confirmed" });
    }
    expect(section.note).toBe("No sizes have been set yet. Set the sizes so each measurement can be given for a size.");
  });

  it("still shows a typed value, with its source, when the sizes are not set", () => {
    const row = rowOf(allRows(buildMeasurements(typed("chest-width", 5200), NO_CHART_SET)), "chest-width");
    expect(row.values[0]).toMatchObject({ status: "set", value: "52.0", provenance: "user-edited" });
  });
});

describe("the how to measure page", () => {
  it("lists each point with its code, label and the sentence from the registry", () => {
    const spec = start("polo");
    const section = buildHowToMeasure(spec);
    const registry = getType("polo")?.pointsOfMeasure ?? [];
    expect(section.id).toBe("how-to-measure");
    expect(section.rows.map((row) => row.pointId)).toEqual(pointsInTableOrder(spec).map((point) => point.id));
    expect(section.rows[0]).toEqual({
      pointId: "chest-width",
      code: "A",
      label: "Chest width",
      howToMeasure: registry.find((point) => point.id === "chest-width")?.howToMeasure,
    });
    expect(section.note).toBeNull();
  });

  it("uses the same codes as the table", () => {
    const spec = designWith("polo", {});
    const table = allRows(buildMeasurements(spec, CHARTS)).map((row) => [row.pointId, row.code]);
    expect(buildHowToMeasure(spec).rows.map((row) => [row.pointId, row.code])).toEqual(table);
  });

  it("says so when the garment has no points of measure", () => {
    const section = buildHowToMeasure({ ...start("crew-tee"), typeId: "kilt" });
    expect(section.rows).toEqual([]);
    expect(section.note).toBe("This garment type has no measurements to explain.");
  });
});

describe("the measurement table with the Knitwright starter charts", () => {
  const spec = accepted(
    applyAction(start("crew-tee", "men"), { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } }),
  ).spec;

  it("grades every size from the starter chart, with a tolerance on every row", () => {
    const section = buildMeasurements(spec);
    expect(section.columns.map((column) => column.label)).toEqual(["S", "M", "L"]);
    for (const row of allRows(section)) {
      expect(row.values.every((value) => value.status === "set")).toBe(true);
      expect(row.tolerance.status).toBe("set");
    }
  });

  it("says the values are Knitwright suggestions to check with the factory", () => {
    expect(buildMeasurements(spec).note).toBe(
      "These measurements are suggestions from the Knitwright starter chart, not a factory's numbers. Check them with your factory before you order.",
    );
  });
});
