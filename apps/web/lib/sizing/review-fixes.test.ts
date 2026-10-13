import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSpec, type GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { parseCsv } from "./csv";
import { MADE_UP_CHART_SET, madeUpChart } from "./fixtures/made-up-charts";
import { MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { gradeSchema } from "./schemas";
import { gradeValues } from "./grading";
import { parseRow, type Cells } from "./parse-row";
import { resolveAllSizes } from "./resolve-all";
import { resolveMeasurements } from "./resolve";
import { parseSourceNote } from "./source-note";

const NONE: ChartSet = { runs: [], charts: [] };
const TODAY = new Date("2026-10-02T00:00:00Z");
const NO_CHART = "There is no Knitwright starter chart yet for Crew neck tee for men, so no measurements are suggested. Type each measurement in, or import your own size chart.";

function crewTee(sizing: GarmentSpec["sizing"], typed = true): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  const measurements = typed ? [{ pointId: "chest-width", value: 5000, provenance: "user-edited" as const }] : [];
  return { ...made.spec, sizing, measurements };
}

const SML = { sizes: ["S", "M", "L"], baseSize: "M" };
const chestRow = (spec: GarmentSpec, size: string, set = NONE) =>
  resolveMeasurements(spec, size, set).rows.find((row) => row.pointId === "chest-width");

describe("item 1: a typed value with no usable chart stays at the base size only", () => {
  const typedFor = (size: string): string =>
    `Chest width was typed in for size M. With no size chart it cannot be worked out for size ${size}. Type a value for this size.`;

  it("shows the value at the base size with a note that names that size", () => {
    expect(chestRow(crewTee(SML), "M")).toEqual({
      status: "set",
      pointId: "chest-width",
      label: "Chest width",
      group: "body",
      groupLabel: "Body",
      value: 5000,
      tolerance: null,
      provenance: "user-edited",
      note: "No size chart applies, so this is the value that was typed in for size M, with no tolerance.",
    });
  });

  it("returns a missing row with a whole sentence at every other size", () => {
    for (const size of ["S", "L"]) {
      expect(chestRow(crewTee(SML), size)).toMatchObject({ status: "missing", message: typedFor(size) });
    }
  });

  it("does the same through resolveAllSizes, so S and L never show 5000", () => {
    const all = resolveAllSizes(crewTee(SML), NONE);
    const statuses = all.entries.map((entry) => entry.resolution.rows.find((row) => row.pointId === "chest-width")?.status);
    expect(statuses).toEqual(["missing", "set", "missing"]);
    expect(all.message).toBe(NO_CHART);
  });

  it("does the same when a chart exists but cannot be graded", () => {
    const broken = { ...madeUpChart("crew-tee", "men"), baseSize: "ZZ" };
    const set = { runs: MADE_UP_RUNS, charts: [broken] };
    expect(chestRow(crewTee(SML), "S", set)).toMatchObject({ status: "missing", message: typedFor("S") });
    expect(chestRow(crewTee(SML), "M", set)).toMatchObject({ status: "set", value: 5000 });
  });

  it("says sizes have not been set yet when the design has no sizes and there is no chart", () => {
    expect(chestRow(crewTee(null), "M")).toMatchObject({
      status: "set",
      value: 5000,
      note: "No size chart applies and sizes have not been set yet, so this is the value that was typed in, with no tolerance.",
    });
  });
});

describe("item b: the whole sentences a person reads when there is no usable chart", () => {
  it("says there is no chart, for a point with no value", () => {
    expect(chestRow(crewTee(null, false), "M")).toMatchObject({
      status: "missing",
      message: `Chest width has no value. ${NO_CHART} Type one in.`,
    });
    expect(resolveMeasurements(crewTee(null, false), "M", NONE).message).toBe(NO_CHART);
  });

  it("says a chart cannot be used yet, and why", () => {
    const broken = { ...madeUpChart("crew-tee", "men"), baseSize: "ZZ" };
    const result = resolveMeasurements(crewTee(null, false), "T3", { runs: MADE_UP_RUNS, charts: [broken] });
    expect(result.message).toBe(
      'The size chart for crew-tee for men cannot be used yet. The base size "ZZ" is not in the men size run, which is T1, T2, T3, T4, T5. Use one of those sizes.',
    );
  });

  it("says a chart exists only for another fit", () => {
    const slim = { runs: MADE_UP_RUNS, charts: [madeUpChart("crew-tee", "men", "slim")] };
    const spec = crewTee(null, false);
    const regular = { ...spec, options: { ...spec.options, fit: { choiceId: "regular", provenance: "user-edited" as const } } };
    expect(resolveMeasurements(regular, "T3", slim).message).toBe(
      "There are size charts for Crew neck tee for men only for the slim fit, and this design is regular. Nothing is guessed, so type each measurement in.",
    );
  });

  it("says a chart names a size run that is missing", () => {
    const result = resolveMeasurements(crewTee(null, false), "T3", { runs: [], charts: [madeUpChart("crew-tee", "men")] });
    expect(result.message).toBe(
      "The size chart for Crew neck tee for men names a size run that is missing, so it cannot be used.",
    );
  });

  it("says a garment type is unknown, and a size is not a size of the design", () => {
    const unknown = resolveMeasurements({ ...crewTee(null, false), typeId: "kilt" }, "M", MADE_UP_CHART_SET);
    expect(unknown.message).toBe("There is no garment type called kilt.");
    const size = resolveMeasurements(crewTee(null, false), "XXL", MADE_UP_CHART_SET);
    expect(size.message).toBe('"XXL" is not a size of this design. The sizes are T1, T2, T3, T4, T5.');
  });
});

describe("items 2, 3 and 5: the source note", () => {
  const refused = (note: string) => parseSourceNote(note, TODAY);

  it("does not find a date inside a longer run of digits", () => {
    const expected = { ok: false, message: "The source needs a date as year, month and day, such as 2026-10-02." };
    expect(refused("Sam 20261-10-02")).toEqual(expected);
    expect(refused("Sam 2026-10-021")).toEqual(expected);
  });

  it("refuses a year before 1900 and accepts 1900", () => {
    expect(refused("Test Person 1899-12-31")).toEqual({ ok: false, message: "The year must be 1900 or later." });
    expect(refused("Test Person 1900-01-01").ok).toBe(true);
  });

  it("refuses a date in the future and accepts today", () => {
    expect(refused("Test Person 2026-10-03")).toEqual({
      ok: false,
      message: "The date is in the future. Use the day the numbers were produced.",
    });
    expect(refused("Test Person 2026-10-02").ok).toBe(true);
  });

  it("refuses a note with more than one date", () => {
    expect(refused("Test Person 2000-01-01 2000-01-02")).toEqual({
      ok: false,
      message: "The source has more than one date. Give only the one day the numbers were produced.",
    });
  });

  it("collapses runs of spaces in the name", () => {
    expect(refused("Test    Person   2000-01-01")).toEqual({
      ok: true,
      source: { person: "Test Person", date: "2000-01-01" },
    });
  });

  it("refuses a name that starts with a formula character", () => {
    for (const start of ["=", "+", "-", "@"]) {
      const name = `${start}Test Person`;
      for (const note of [`${name} 2000-01-01`, `2000-01-01, ${name}`]) {
        expect(refused(note)).toEqual({
          ok: false,
          message: `The name "${name}" starts with an equals, plus, minus or at sign, so a spreadsheet could read it as a formula. Write the name without it.`,
        });
      }
    }
  });

  it("still accepts a dash used as a separator", () => {
    expect(refused("2000-01-01 - Test Person").ok).toBe(true);
    expect(refused("Test Person - 2000-01-01").ok).toBe(true);
  });
});

describe("items 4 and 9: text after a closing quote, and a lone carriage return", () => {
  const AFTER = (line: number): string =>
    `Line ${line} has text after a closing quote. Put a comma after the closing quote, or remove the extra text.`;

  it("refuses text stuck to a closing quote", () => {
    expect(parseCsv('a,"b"c,d')).toEqual({ ok: false, line: 1, message: AFTER(1) });
    expect(parseCsv('"52"5')).toEqual({ ok: false, line: 1, message: AFTER(1) });
    expect(parseCsv('"a" ,b')).toEqual({ ok: false, line: 1, message: AFTER(1) });
    expect(parseCsv('x\n"b"c')).toEqual({ ok: false, line: 2, message: AFTER(2) });
  });

  it("still accepts a comma, a line break or the end after a closing quote", () => {
    expect(parseCsv('"a",b\n"c"\r\n"d"').ok).toBe(true);
    expect(parseCsv('"a""b"').ok).toBe(true);
  });

  it("counts a lone carriage return inside quotes as a new line", () => {
    const result = parseCsv('a\n"x\ry"\nz');
    expect(result.ok && result.records.map((record) => record.line)).toEqual([1, 2, 4]);
  });

  it("counts a Windows line break inside quotes once", () => {
    const result = parseCsv('a\n"x\r\ny"\nz');
    expect(result.ok && result.records.map((record) => record.line)).toEqual([1, 2, 4]);
  });
});

const cells = (over: Partial<Cells>): Cells => ({
  wearer: "men",
  garment_type: "crew-tee",
  fit: "",
  point_of_measure: "chest-width",
  base_size: "T3",
  base_value_cm: "20",
  grade_cm: "1",
  tolerance_cm: "1",
  source: "Test Person 2000-01-01",
  ...over,
});

describe("item 7: a negative grade", () => {
  it("is refused with a sentence about grades", () => {
    for (const grade of ["-1", "1/-2/1/1"]) {
      const result = parseRow(2, cells({ grade_cm: grade }));
      expect(result.ok).toBe(false);
      expect(!result.ok && result.problems[0]?.message).toBe(
        "Line 2, column grade_cm: A grade cannot be negative. Use 0 if the value stays the same.",
      );
    }
  });

  it("is refused by the schema too", () => {
    expect(gradeSchema.safeParse({ kind: "even", step: -1 }).success).toBe(false);
    expect(gradeSchema.safeParse({ kind: "steps", steps: [-1, 2] }).success).toBe(false);
    expect(gradeSchema.safeParse({ kind: "even", step: 0 }).success).toBe(true);
  });
});

describe("item 8: a zero can never stand in for a value", () => {
  it("throws when the base index is outside the sizes", () => {
    expect(() => gradeValues(1000, [1, 2], 5)).toThrow("Sizing broke a rule it depends on");
  });

  it("throws when a grade step is missing", () => {
    expect(() => gradeValues(1000, [1, , 3] as unknown as number[], 0)).toThrow("Sizing broke a rule it depends on");
  });
});

describe("item 6: each doc comment sits on its own field", () => {
  it("never stacks one comment directly on another in the result types", () => {
    const text = readFileSync(new URL("./resolution-types.ts", import.meta.url), "utf8");
    expect(text).not.toMatch(/\*\/\s*\n\s*\/\*\*/);
  });
});

describe("test a: a row with only one of the filled columns is not skipped", () => {
  const HEADER = "wearer,garment_type,fit,point_of_measure,base_size,base_value_cm,grade_cm,tolerance_cm,source";
  it.each([
    ["source", "men,crew-tee,,chest-width,,,,,Test Person 2000-01-01"],
    ["base_size", "men,crew-tee,,chest-width,T3,,,,"],
    ["base_value_cm", "men,crew-tee,,chest-width,,20,,,"],
    ["grade_cm", "men,crew-tee,,chest-width,,,1,,"],
    ["tolerance_cm", "men,crew-tee,,chest-width,,,,1,"],
  ])("refuses a row with only %s filled", async (_column, line) => {
    const { parseChartsCsv } = await import("./parse-charts");
    const result = parseChartsCsv(`${HEADER}\n${line}`, MADE_UP_RUNS);
    expect(result.ok).toBe(false);
  });
});

describe("test c: an unknown point of measure is reported by the row check", () => {
  it("names the line and the column", () => {
    const result = parseRow(7, cells({ point_of_measure: "sock-height" }));
    expect(!result.ok && result.problems).toEqual([
      {
        line: 7,
        column: "point_of_measure",
        message: 'Line 7, column point_of_measure: "sock-height" is not a point of measure we know. Check the spelling.',
      },
    ]);
  });
});
