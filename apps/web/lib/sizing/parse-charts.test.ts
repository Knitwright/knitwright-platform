import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { deepFreeze } from "./fixtures/freeze";
import { parseChartsCsv, type ParseProblem } from "./parse-charts";
import { buildChartSet } from "./validate";

const HEADER = "wearer,garment_type,fit,point_of_measure,base_size,base_value_cm,grade_cm,tolerance_cm,source";
const row = (cells: readonly string[]): string => cells.join(",");
const good = (point: string, extra: Partial<Record<number, string>> = {}): string => {
  const cells = ["men", "crew-tee", "", point, "T3", "20.5", "1", "1", `"Test Person, 2000-01-01"`];
  Object.entries(extra).forEach(([index, value]) => {
    cells[Number(index)] = value ?? "";
  });
  return row(cells);
};
const csv = (...lines: string[]): string => [HEADER, ...lines].join("\n");

function problemsOf(text: string): readonly ParseProblem[] {
  const result = parseChartsCsv(deepFreeze(text), deepFreeze(structuredClone(MADE_UP_RUNS)));
  if (result.ok) throw new Error("Expected problems.");
  return result.problems;
}

describe("parseChartsCsv reading good files", () => {
  it("builds one chart with exact tenths of a millimetre and a named source", () => {
    const result = parseChartsCsv(
      csv(good("chest-width"), good("body-length", { 5: "70", 6: "1/2/1/2", 7: "1.5" })),
      MADE_UP_RUNS,
    );
    expect(result).toEqual({
      ok: true,
      skippedLines: [],
      charts: [
        {
          wearer: "men",
          garmentType: "crew-tee",
          fit: null,
          sizeRunId: "made-up-men",
          baseSize: "T3",
          points: [
            { pointId: "chest-width", baseValue: 2050, grade: { kind: "even", step: 100 }, tolerance: 100 },
            {
              pointId: "body-length",
              baseValue: 7000,
              grade: { kind: "steps", steps: [100, 200, 100, 200] },
              tolerance: 150,
            },
          ],
          source: { person: "Test Person", date: "2000-01-01" },
        },
      ],
    });
  });

  it("produces charts that the chart set check accepts", () => {
    const result = parseChartsCsv(csv(good("chest-width")), MADE_UP_RUNS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(buildChartSet(MADE_UP_RUNS, result.charts).ok).toBe(true);
  });

  it("reads Windows line endings, a byte order mark, a mixed case header and trailing blank lines", () => {
    const header = " Wearer ,GARMENT_TYPE,Fit,Point_Of_Measure,BASE_SIZE,Base_Value_CM,Grade_CM,Tolerance_CM,Source";
    const text = `﻿${header}\r\n${good("chest-width")}\r\n\r\n\r\n`;
    const result = parseChartsCsv(text, MADE_UP_RUNS);
    expect(result.ok && result.charts).toHaveLength(1);
  });

  it("gives each fit its own chart", () => {
    const result = parseChartsCsv(
      csv(good("chest-width"), good("chest-width", { 2: "slim" }), good("chest-width", { 2: "Relaxed" })),
      MADE_UP_RUNS,
    );
    expect(result.ok && result.charts.map((chart) => chart.fit)).toEqual([null, "slim", "relaxed"]);
  });

  it("accepts a source with the date first", () => {
    const result = parseChartsCsv(csv(good("chest-width", { 8: "2000-01-01 by Test Person" })), MADE_UP_RUNS);
    expect(result.ok && result.charts[0]?.source).toEqual({ person: "Test Person", date: "2000-01-01" });
  });

  it("skips rows that are not filled in yet and says which lines", () => {
    const blank = "men,crew-tee,,body-length,,,,,";
    const result = parseChartsCsv(csv(good("chest-width"), blank), MADE_UP_RUNS);
    expect(result.ok && result.skippedLines).toEqual([3]);
    expect(result.ok && result.charts).toHaveLength(1);
  });

  it("reads the owner's blank template as no charts and eleven skipped lines", () => {
    const text = readFileSync(new URL("../../../../docs/owner/size-chart-template.csv", import.meta.url), "utf8");
    const result = parseChartsCsv(text, MADE_UP_RUNS);
    expect(result.ok && result.charts).toEqual([]);
    expect(result.ok && result.skippedLines).toHaveLength(11);
  });
});

interface Refusal {
  readonly name: string;
  readonly text: string;
  readonly line: number;
  readonly column: string | null;
  readonly fragment: string;
}

const refusals: readonly Refusal[] = [
  { name: "an unknown garment type", text: csv(good("chest-width", { 1: "kilt" })), line: 2, column: "garment_type", fragment: "kilt" },
  { name: "an unknown wearer", text: csv(good("chest-width", { 0: "pets" })), line: 2, column: "wearer", fragment: "pets" },
  { name: "an unknown fit", text: csv(good("chest-width", { 2: "tight" })), line: 2, column: "fit", fragment: "tight" },
  { name: "an unknown point of measure", text: csv(good("sock-height")), line: 2, column: "point_of_measure", fragment: "sock-height" },
  { name: "a point that does not belong to the garment type", text: csv(good("placket-length")), line: 2, column: "point_of_measure", fragment: "crew-tee" },
  { name: "a missing point of measure", text: csv(good("")), line: 2, column: "point_of_measure", fragment: "Enter" },
  { name: "a missing source", text: csv(good("chest-width", { 8: "" })), line: 2, column: "source", fragment: "source" },
  { name: "a source with no date", text: csv(good("chest-width", { 8: "Test Person" })), line: 2, column: "source", fragment: "date" },
  { name: "a source with no person", text: csv(good("chest-width", { 8: "2000-01-01" })), line: 2, column: "source", fragment: "person" },
  { name: "a source that is a formula", text: csv(good("chest-width", { 8: "=HYPERLINK(1)" })), line: 2, column: "source", fragment: "date" },
  { name: "a base size not in the size run", text: csv(good("chest-width", { 4: "XXL" })), line: 2, column: "base_size", fragment: "T1, T2, T3, T4, T5" },
  { name: "an empty base size", text: csv(good("chest-width", { 4: "" })), line: 2, column: "base_size", fragment: "base size" },
  { name: "too few grade steps", text: csv(good("chest-width", { 6: "1/2" })), line: 2, column: "grade_cm", fragment: "4" },
  { name: "too many grade steps", text: csv(good("chest-width", { 6: "1/1/1/1/1" })), line: 2, column: "grade_cm", fragment: "4" },
  { name: "a base value that is not a number", text: csv(good("chest-width", { 5: "wide" })), line: 2, column: "base_value_cm", fragment: "not a number" },
  { name: "a comma used as the decimal mark", text: csv(good("chest-width", { 5: '"52,5"' })), line: 2, column: "base_value_cm", fragment: "not a number" },
  { name: "a negative base value", text: csv(good("chest-width", { 5: "-5" })), line: 2, column: "base_value_cm", fragment: "negative" },
  { name: "a negative grade", text: csv(good("chest-width", { 6: "1/-2/1/1" })), line: 2, column: "grade_cm", fragment: "negative" },
  { name: "a negative tolerance", text: csv(good("chest-width", { 7: "-1" })), line: 2, column: "tolerance_cm", fragment: "negative" },
  { name: "a formula in a number cell", text: csv(good("chest-width", { 5: "=1+2" })), line: 2, column: "base_value_cm", fragment: "text" },
  { name: "a plus sign in a number cell", text: csv(good("chest-width", { 6: "+1" })), line: 2, column: "grade_cm", fragment: "text" },
  { name: "an at sign in a number cell", text: csv(good("chest-width", { 7: "@SUM(A1)" })), line: 2, column: "tolerance_cm", fragment: "text" },
  { name: "more precision than a tenth of a millimetre", text: csv(good("chest-width", { 5: "52.555" })), line: 2, column: "base_value_cm", fragment: "tenth of a millimetre" },
  { name: "a number that is too large", text: csv(good("chest-width", { 5: "999" })), line: 2, column: "base_value_cm", fragment: "300" },
  { name: "a zero base value", text: csv(good("chest-width", { 5: "0" })), line: 2, column: "base_value_cm", fragment: "above zero" },
  { name: "a zero tolerance", text: csv(good("chest-width", { 7: "0" })), line: 2, column: "tolerance_cm", fragment: "above zero" },
  { name: "an empty grade", text: csv(good("chest-width", { 6: "" })), line: 2, column: "grade_cm", fragment: "0 if" },
  { name: "an empty tolerance", text: csv(good("chest-width", { 7: "" })), line: 2, column: "tolerance_cm", fragment: "Enter" },
  { name: "a point given twice for one chart", text: csv(good("chest-width"), good("body-length"), good("chest-width")), line: 4, column: "point_of_measure", fragment: "line 2" },
  { name: "a base size that changes inside one chart", text: csv(good("chest-width"), good("body-length", { 4: "T2" })), line: 3, column: "base_size", fragment: "line 2" },
  { name: "a source that changes inside one chart", text: csv(good("chest-width"), good("body-length", { 8: "Other Person 2001-02-03" })), line: 3, column: "source", fragment: "line 2" },
  { name: "a value that grades to zero", text: csv(good("chest-width", { 5: "1", 6: "1" })), line: 2, column: "grade_cm", fragment: "T1" },
  { name: "a wearer the garment type does not offer", text: csv("youth,polo,,collar-height,V2,5,1,1,Test Person 2000-01-01").replace("polo", "kilt"), line: 2, column: "garment_type", fragment: "kilt" },
  { name: "a quote that never closes", text: `${HEADER}\nmen,"oops`, line: 2, column: null, fragment: "quote" },
];

describe("parseChartsCsv refusing bad files", () => {
  it.each(refusals)("refuses $name, naming the line and the column", ({ text, line, column, fragment }) => {
    const problems = problemsOf(text);
    const found = problems.find((candidate) => candidate.line === line && candidate.column === column);
    expect(found).toBeDefined();
    expect(found?.message).toContain(fragment);
    expect(found?.message).toContain(`Line ${line}`);
    if (column !== null) expect(found?.message).toContain(column);
  });

  it("refuses an empty file", () => {
    expect(problemsOf("")[0]?.message).toContain("empty");
    expect(problemsOf("\n\n")[0]?.message).toContain("empty");
  });

  it("names every missing column in the header", () => {
    const problems = problemsOf("wearer,garment_type\nmen,crew-tee");
    expect(problems[0]).toMatchObject({ line: 1, column: "fit" });
    expect(problems.map((found) => found.column)).toContain("source");
  });

  it("refuses a row with more cells than the header", () => {
    const problems = problemsOf(csv(`${good("chest-width")},extra`));
    expect(problems[0]?.message).toContain("more cells");
  });

  it("refuses a wearer that has no size run", () => {
    const result = parseChartsCsv(csv(good("chest-width")), []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.message).toContain("size run");
  });

  it("reports every problem it finds, in line order, not just the first", () => {
    const problems = problemsOf(
      csv(good("chest-width", { 5: "-1" }), good("body-length", { 6: "abc" }), good("armhole", { 7: "" })),
    );
    expect(problems.map((found) => found.line)).toEqual([2, 3, 4]);
  });

  it("writes messages without dashes as punctuation or semicolons", () => {
    for (const refusal of refusals) {
      for (const found of problemsOf(refusal.text)) {
        expect(found.message).not.toMatch(/;| - /);
      }
    }
  });
});
