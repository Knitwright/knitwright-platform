import { describe, expect, it } from "vitest";
import { getType } from "@/lib/garment";
import { pointsAlwaysApplying, sizeChartSchema, sizeRunSchema } from "@/lib/sizing";
import { gridFromCsv, type Grid } from "./grid";
import { formatLength } from "@/lib/units/length";
import { applyMapping, chartMappingSchema, rowAssignments, suggestMapping, type ChartMapping } from "./mapping";

/**
 * MADE-UP NUMBERS FOR TESTS ONLY. They are not garment measurements. Each point's value
 * grows by one centimetre a size, and the points differ by a centimetre each.
 */
const crewTeePoints = (): readonly { id: string; label: string }[] => {
  const type = getType("crew-tee");
  if (!type) throw new Error("No crew tee.");
  return pointsAlwaysApplying(type).map((point) => ({ id: point.id, label: point.label }));
};

const madeUpCsv = (options: { skip?: string; extra?: string; label?: (point: { id: string; label: string }) => string } = {}): string => {
  const lines = ["Point of measure,S,M,L,Tolerance"];
  crewTeePoints().forEach((point, index) => {
    if (point.id === options.skip) return;
    const base = 20 + index;
    lines.push(`${options.label ? options.label(point) : point.label},${base},${base + 1},${base + 2},1`);
  });
  if (options.extra) lines.push(options.extra);
  return lines.join("\n");
};

const gridOf = (text: string): Grid => {
  const result = gridFromCsv(text);
  if (!result.ok) throw new Error(result.message);
  return result.grid;
};

const mapping = (overrides: Partial<ChartMapping> = {}): ChartMapping => ({
  wearer: "men",
  garmentType: "crew-tee",
  fit: null,
  headerLine: 1,
  pointColumn: 0,
  units: "cm",
  unitsColumn: null,
  sizeColumns: [1, 2, 3],
  toleranceColumn: 4,
  baseSize: "M",
  person: "Test Person",
  rowPoints: [],
  ...overrides,
});

const TODAY = "2026-09-29";

describe("suggestMapping", () => {
  it("finds the point column, the size columns and the tolerance column from the heading row", () => {
    expect(suggestMapping(gridOf(madeUpCsv()))).toEqual({
      headerLine: 1,
      pointColumn: 0,
      sizeColumns: [1, 2, 3],
      toleranceColumn: 4,
      units: "cm",
      unitsColumn: null,
      baseSize: "M",
    });
  });

  it("finds a units column, and keeps it out of the size columns", () => {
    const suggestion = suggestMapping(gridOf("Point of measure,Units,S,M,Tolerance\nChest width,in,20,21,0.5\n"));
    expect(suggestion).toMatchObject({ pointColumn: 0, unitsColumn: 1, sizeColumns: [2, 3], toleranceColumn: 4 });
  });

  it("suggests inches when a heading says so, and centimetres otherwise", () => {
    expect(suggestMapping(gridOf("Point (in),S,M,Tol\nChest width,20,21,0.5\n")).units).toBe("in");
    expect(suggestMapping(gridOf("Measurements in inches,S,M,Tol\nChest width,20,21,0.5\n")).units).toBe("in");
    expect(suggestMapping(gridOf("Point,S,M,Tol\nChest width,50,52,1\n")).units).toBe("cm");
  });

  it("suggests nothing for tolerance when no heading says so", () => {
    const suggestion = suggestMapping(gridOf("POM,XS,S\nChest width,1,2\n"));
    expect(suggestion.toleranceColumn).toBeNull();
    expect(suggestion.sizeColumns).toEqual([1, 2]);
  });

  it("gives an empty suggestion for an empty grid", () => {
    expect(suggestMapping([])).toEqual({
      headerLine: 1,
      pointColumn: 0,
      sizeColumns: [],
      toleranceColumn: null,
      units: "cm",
      unitsColumn: null,
      baseSize: "",
    });
  });
});

describe("rowAssignments", () => {
  it("matches rows to points by name or id, ignoring case, spaces and punctuation", () => {
    const text = madeUpCsv({ label: (point) => (point.id === "chest-width" ? "CHEST-WIDTH" : point.label.toUpperCase()) });
    const rows = rowAssignments(gridOf(text), mapping());
    expect(rows.every((row) => row.pointId !== null)).toBe(true);
    expect(rows.find((row) => row.label === "CHEST-WIDTH")).toMatchObject({ pointId: "chest-width", chosen: false });
  });

  it("leaves a row it cannot match without a point", () => {
    const rows = rowAssignments(gridOf(madeUpCsv({ extra: "Waist,1,2,3,1" })), mapping());
    expect(rows.at(-1)).toMatchObject({ label: "Waist", pointId: null });
  });

  it("uses the point a person chose for a row, or none when they chose to leave it out", () => {
    const grid = gridOf(madeUpCsv({ extra: "Waist,1,2,3,1" }));
    const waistLine = grid.at(-1)?.line ?? 0;
    const chosen = rowAssignments(grid, mapping({ rowPoints: [{ line: 2, pointId: null }, { line: waistLine, pointId: "hem-width" }] }));
    expect(chosen.find((row) => row.line === 2)).toMatchObject({ pointId: null, chosen: true });
    expect(chosen.find((row) => row.line === waistLine)).toMatchObject({ pointId: "hem-width", chosen: true });
  });

  it("gives nothing for a garment type that does not exist", () => {
    expect(rowAssignments(gridOf(madeUpCsv()), mapping({ garmentType: "cape" }))).toEqual([]);
  });
});

describe("applyMapping, a valid file", () => {
  const result = applyMapping(gridOf(madeUpCsv()), mapping(), TODAY);

  it("gives a chart and a size run that the sizing schemas accept", () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sizeChartSchema.safeParse(result.chart).success).toBe(true);
    expect(sizeRunSchema.safeParse(result.run).success).toBe(true);
    expect(result.run.sizes).toEqual(["S", "M", "L"]);
    expect(result.chart.baseSize).toBe("M");
  });

  it("marks the chart as the brand's own, with the person named and today's date", () => {
    if (!result.ok) throw new Error("Expected a chart.");
    expect(result.chart.supplier).toBe("brand");
    expect(result.chart.source).toEqual({ person: "Test Person", date: TODAY });
  });

  it("keeps every value of the file exactly, in tenths of a millimetre", () => {
    if (!result.ok) throw new Error("Expected a chart.");
    const chest = result.chart.points.find((point) => point.pointId === "chest-width");
    expect(chest).toEqual({ pointId: "chest-width", baseValue: 2100, grade: { kind: "steps", steps: [100, 100] }, tolerance: 100 });
  });

  it("uses an even grade when there are only two sizes", () => {
    const text = "Point,S,M,Tol\n" + crewTeePoints().map((point) => `${point.label},50,52.5,1`).join("\n");
    const two = applyMapping(gridOf(text), mapping({ sizeColumns: [1, 2], toleranceColumn: 3 }), TODAY);
    expect(two.ok && two.chart.points[0]?.grade).toEqual({ kind: "even", step: 250 });
  });

  it("lets a row be left out, and lets an unknown row be given a point", () => {
    const grid = gridOf(madeUpCsv({ skip: "hem-width", extra: "Sweep,40,41,42,1" }));
    const sweep = grid.at(-1)?.line ?? 0;
    const chosen = applyMapping(grid, mapping({ rowPoints: [{ line: sweep, pointId: "hem-width" }] }), TODAY);
    expect(chosen.ok).toBe(true);
  });

  it("does not ask for a point that only some jerseys have", () => {
    const type = getType("team-jersey");
    if (!type) throw new Error("No jersey.");
    const lines = ["Point,S,M,Tol", ...pointsAlwaysApplying(type).map((point) => `${point.label},30,31,1`)];
    const jersey = applyMapping(gridOf(lines.join("\n")), mapping({ garmentType: "team-jersey", sizeColumns: [1, 2], toleranceColumn: 3, baseSize: "S" }), TODAY);
    expect(jersey.ok).toBe(true);
  });
});

/** Owner decision 2026-09-30: a chart file may be in centimetres or inches. */
describe("applyMapping, a file in inches", () => {
  /** MADE-UP NUMBERS FOR TESTS ONLY: each point grows by half an inch a size. */
  const inchesCsv = (unitCell?: (index: number) => string): string => {
    const head = unitCell ? "Point of measure,Units,S,M,L,Tolerance" : "Point of measure,S,M,L,Tolerance";
    const lines = [head];
    crewTeePoints().forEach((point, index) => {
      const base = 10 + index;
      const values = `${base},${base} 1/2,${base + 1},1/4`;
      lines.push(unitCell ? `${point.label},${unitCell(index)},${values}` : `${point.label},${values}`);
    });
    return lines.join("\n");
  };
  const withUnits = { unitsColumn: 1, sizeColumns: [2, 3, 4], toleranceColumn: 5 };

  it("stores the values in centimetres, as tenths of a millimetre", () => {
    const result = applyMapping(gridOf(inchesCsv()), mapping({ units: "in" }), TODAY);
    if (!result.ok) throw new Error(result.problems.join("\n"));
    const chest = result.chart.points.find((point) => point.pointId === "chest-width");
    const index = crewTeePoints().findIndex((point) => point.id === "chest-width");
    // M is (10 + index) 1/2 inches; each size is half an inch (127 tenths of a mm) apart.
    expect(chest).toEqual({
      pointId: "chest-width",
      baseValue: Math.round((10 + index + 0.5) * 254),
      grade: { kind: "steps", steps: [127, 127] },
      tolerance: Math.round(254 / 4),
    });
  });

  it("goes there and back: the stored chart, shown in inches, gives the numbers of the file", () => {
    const result = applyMapping(gridOf(inchesCsv()), mapping({ units: "in" }), TODAY);
    if (!result.ok) throw new Error(result.problems.join("\n"));
    crewTeePoints().forEach((point, index) => {
      const stored = result.chart.points.find((found) => found.pointId === point.id);
      if (!stored) throw new Error(`No ${point.id}`);
      expect(formatLength(stored.baseValue / 100, "in")).toBe(`${10 + index} 1/2 in`);
      expect(formatLength(stored.tolerance / 100, "in")).toBe("1/4 in");
    });
  });

  it("gives the same chart from a file in inches and the same file in centimetres", () => {
    const cm = "Point,S,M,Tol\n" + crewTeePoints().map((point) => `${point.label},50.8,53.34,1.27`).join("\n");
    const inches = "Point,S,M,Tol\n" + crewTeePoints().map((point) => `${point.label},20,21,1/2`).join("\n");
    const two = { sizeColumns: [1, 2], toleranceColumn: 3, baseSize: "S" };
    const fromCm = applyMapping(gridOf(cm), mapping(two), TODAY);
    const fromInches = applyMapping(gridOf(inches), mapping({ ...two, units: "in" }), TODAY);
    if (!fromCm.ok || !fromInches.ok) throw new Error("Expected charts.");
    expect(fromInches.chart.points).toEqual(fromCm.chart.points);
  });

  it("reads each row's unit from a units column, an empty cell using the unit chosen on the screen", () => {
    const text = inchesCsv((index) => (index === 0 ? "" : index % 2 === 0 ? "in" : "Inches"));
    const result = applyMapping(gridOf(text), mapping({ ...withUnits, units: "in" }), TODAY);
    expect(result.ok).toBe(true);
  });

  it("lets the units column overrule the screen for a row", () => {
    const lines = inchesCsv((index) => (index === 0 ? "cm" : "in")).split("\n");
    const [first] = crewTeePoints();
    lines[1] = `${first?.label},cm,50,51,52,1`;
    const result = applyMapping(gridOf(lines.join("\n")), mapping({ ...withUnits, units: "in" }), TODAY);
    if (!result.ok) throw new Error(result.problems.join("\n"));
    expect(result.chart.points.find((point) => point.pointId === first?.id)?.baseValue).toBe(5100);
  });

  it("refuses a unit it does not know, naming the line and the unit", () => {
    const text = inchesCsv((index) => (index === 2 ? "mm" : "in"));
    const result = applyMapping(gridOf(text), mapping(withUnits), TODAY);
    if (result.ok) throw new Error("Expected a refusal.");
    expect(result.problems.join("\n")).toMatch(/Line 4: the unit "mm" is not one we read\. Write cm or in/);
  });

  it("refuses a unit the mapping itself does not know", () => {
    expect(chartMappingSchema.safeParse({ ...mapping(), units: "mm" }).success).toBe(false);
  });

  it("refuses a units column that is also another column", () => {
    const result = applyMapping(gridOf(inchesCsv((index) => (index === 0 ? "in" : "in"))), mapping({ ...withUnits, unitsColumn: 2 }), TODAY);
    if (result.ok) throw new Error("Expected a refusal.");
    expect(result.problems.join("\n")).toMatch(/units column is also chosen as a size column/);
  });

  it("names inches in its messages about a row in inches", () => {
    const text = inchesCsv().replace(/,1\/4$/m, ",a quarter");
    const result = applyMapping(gridOf(text), mapping({ units: "in" }), TODAY);
    if (result.ok) throw new Error("Expected a refusal.");
    expect(result.problems.join("\n")).toMatch(/tolerance above zero, in inches.*not a number of inches/);
  });
});

describe("applyMapping, a file missing a point of measure", () => {
  it("is refused and names the missing point", () => {
    const result = applyMapping(gridOf(madeUpCsv({ skip: "chest-width" })), mapping(), TODAY);
    expect(result).toMatchObject({ ok: false, missing: ["Chest width"] });
    if (!result.ok) expect(result.problems.join(" ")).toContain("Chest width");
  });

  it("names every missing point", () => {
    const text = "Point,S,M,L,Tol\nChest width,1,2,3,1";
    const result = applyMapping(gridOf(text), mapping(), TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toHaveLength(crewTeePoints().length - 1);
  });

  it("counts a row a person left out as missing", () => {
    const result = applyMapping(gridOf(madeUpCsv()), mapping({ rowPoints: [{ line: 2, pointId: null }] }), TODAY);
    expect(result).toMatchObject({ ok: false, missing: [crewTeePoints()[0]?.label] });
  });
});

describe("applyMapping, values checked against the registry", () => {
  const refused = (text: string, overrides: Partial<ChartMapping> = {}): string => {
    const result = applyMapping(gridOf(text), mapping(overrides), TODAY);
    if (result.ok) throw new Error("Expected a refusal.");
    return result.problems.join("\n");
  };

  it("refuses a row it cannot match to a point, naming its line", () => {
    const problems = refused(madeUpCsv({ extra: "Waist,1,2,3,1" }));
    expect(problems).toMatch(/Line 13.*Waist/);
  });

  it("refuses a point this garment does not have", () => {
    expect(refused(madeUpCsv({ extra: "Collar height,1,2,3,1" }))).toMatch(/Collar height.*Crew neck tee/);
  });

  it("refuses a point given twice", () => {
    expect(refused(madeUpCsv({ extra: "Chest width,1,2,3,1" }))).toMatch(/Chest width.*twice|already/);
  });

  it("refuses a cell that is a formula, and never works it out", () => {
    const text = madeUpCsv().replace("Chest width,20", "Chest width,=SUM(A1)");
    expect(refused(text)).toMatch(/=SUM\(A1\)/);
  });

  it("refuses text, an empty cell and a negative value, naming the size", () => {
    expect(refused(madeUpCsv().replace("Chest width,20,21", "Chest width,big,21"))).toMatch(/size S/);
    expect(refused(madeUpCsv().replace("Chest width,20,21", "Chest width,,21"))).toMatch(/size S/);
    expect(refused(madeUpCsv().replace("Chest width,20,21", "Chest width,-20,21"))).toMatch(/negative/);
  });

  it("refuses a value that gets smaller as sizes go up", () => {
    expect(refused(madeUpCsv().replace("Chest width,20,21,22", "Chest width,20,19,22"))).toMatch(/smaller/);
  });

  it("refuses a tolerance of zero or none", () => {
    expect(refused(madeUpCsv().replace("Chest width,20,21,22,1", "Chest width,20,21,22,0"))).toMatch(/tolerance/i);
    expect(refused(madeUpCsv().replace("Chest width,20,21,22,1", "Chest width,20,21,22,"))).toMatch(/tolerance/i);
  });

  it("refuses sizes that are blank, repeated or too long", () => {
    expect(refused(madeUpCsv().replace("S,M,L", "S,M,S"))).toMatch(/S.*more than once/);
    expect(refused(madeUpCsv().replace("S,M,L", "S,M,"), { baseSize: "M" })).toMatch(/no size name/);
    expect(refused(madeUpCsv().replace("S,M,L", "S,M,EXTRA-LARGE-TALL"))).toMatch(/12/);
  });

  it("refuses a base size that is not one of the sizes", () => {
    expect(refused(madeUpCsv(), { baseSize: "XL" })).toMatch(/XL/);
  });

  it("refuses columns that overlap or are not in the file", () => {
    expect(refused(madeUpCsv(), { toleranceColumn: 1 })).toMatch(/column/);
    expect(refused(madeUpCsv(), { pointColumn: 2 })).toMatch(/column/);
    expect(refused(madeUpCsv(), { sizeColumns: [1, 2, 9] })).toMatch(/column/i);
  });

  it("refuses a heading line that is not in the file", () => {
    expect(refused(madeUpCsv(), { headerLine: 99 })).toMatch(/99/);
  });

  it("refuses a garment type that does not exist, and a wearer the garment is not made for", () => {
    expect(refused(madeUpCsv(), { garmentType: "cape" })).toMatch(/cape/);
  });

  it("refuses a placeholder name as the source of the numbers", () => {
    expect(refused(madeUpCsv(), { person: "tbc" })).toMatch(/real person/);
  });
});
