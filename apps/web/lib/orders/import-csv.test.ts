import { describe, expect, it } from "vitest";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { csvLine } from "./text";
import { detectMapping, parseRosterCsv, ROSTER_ROWS_MAX } from "./import-csv";

const csv = (...lines: string[][]) => lines.map((l) => csvLine(l)).join("");
const RUN = ["S", "M", "L", "XL"];

describe("detectMapping", () => {
  it("finds columns by the names people use", () => {
    expect(detectMapping(["Player Name", "No.", "Shirt size", "Fit", "Qty"])).toEqual({ name: 0, number: 1, sizeLabel: 2, cut: 3, quantity: 4 });
  });
  it("leaves out what it cannot find", () => {
    expect(detectMapping(["Surname", "#", "Size"])).toEqual({ name: 0, number: 1, sizeLabel: 2 });
  });
  it("uses a column once", () => {
    expect(detectMapping(["Number", "Number"])).toEqual({ number: 0 });
  });
});

describe("parseRosterCsv", () => {
  it("reads the sample roster back from its own export", () => {
    const text = csv(["Name", "Number", "Size", "Cut", "Qty"], ...ROSTER_22.rows.map((r) => [r.name, r.number, r.sizeLabel, r.cut, String(r.quantity)]));
    const result = parseRosterCsv(text, { run: ["S", "M", "L", "XL", "2XL", "3XL"] });
    expect(result).toMatchObject({ ok: true, problems: [] });
    expect(result.ok && result.rows).toEqual(ROSTER_22.rows);
  });
  it("matches sizes to the run ignoring case, and reads cut words", () => {
    const result = parseRosterCsv(csv(["Name", "Number", "Size", "Fit"], ["Ana", "#9", "xl", "Women's"]), { run: RUN });
    expect(result.ok && result.rows).toEqual([{ name: "Ana", number: "9", sizeLabel: "XL", cut: "womens", quantity: 1 }]);
  });
  it("uses the default cut when no column says it", () => {
    const result = parseRosterCsv(csv(["Name", "Number", "Size"], ["Ana", "9", "M"]), { defaultCut: "junior" });
    expect(result.ok && result.rows[0]?.cut).toBe("junior");
  });
  it("asks for a mapping when the number or size column is missing", () => {
    const result = parseRosterCsv(csv(["Name", "Foo"], ["Ana", "9"]));
    expect(result).toMatchObject({ ok: false, needsMapping: true, headers: ["Name", "Foo"] });
  });
  it("uses a mapping the person chose", () => {
    const result = parseRosterCsv(csv(["A", "B", "C"], ["9", "M", "Ana"]), { mapping: { number: 0, sizeLabel: 1, name: 2 } });
    expect(result.ok && result.rows).toEqual([{ name: "Ana", number: "9", sizeLabel: "M", cut: "unisex", quantity: 1 }]);
  });
  it("refuses a mapping that points past the columns", () => {
    expect(parseRosterCsv(csv(["A", "B"], ["1", "M"]), { mapping: { number: 0, sizeLabel: 5 } })).toMatchObject({ ok: false });
  });
  it("keeps good rows and reports each bad one with its line", () => {
    const result = parseRosterCsv(
      csv(["Name", "Number", "Size", "Qty"], ["Ana", "9", "M", "1"], ["=HACK()", "10", "M", "1"], ["Bo", "1000", "M", "1"], ["Cy", "11", "M", "0"], ["Di", "12", "M", "x"], ["Ed", "13", "M", "1"]),
    );
    expect(result.ok && result.rows.map((r) => r.name)).toEqual(["Ana", "Ed"]);
    expect(result.ok && result.problems.map((p) => p.line)).toEqual([3, 4, 5, 6]);
  });
  it("cleans hidden characters out of names", () => {
    const result = parseRosterCsv(csv(["Name", "Number", "Size"], ["A‮B", "1", "M"]));
    expect(result.ok && result.rows[0]?.name).toBe("AB");
  });
  it("reports a cut it does not know", () => {
    const result = parseRosterCsv(csv(["Name", "Number", "Size", "Cut"], ["Ana", "9", "M", "weird"]));
    expect(result.ok && result.problems).toHaveLength(1);
  });
  it("passes on a broken file with the line and the reason", () => {
    expect(parseRosterCsv('Name,Number,Size\r\n"Ana,9,M')).toMatchObject({ ok: false, needsMapping: false });
  });
  it("refuses a file with only a header", () => {
    expect(parseRosterCsv("Name,Number,Size\r\n")).toMatchObject({ ok: false, needsMapping: false });
  });
  it("refuses more rows than a roster may hold", () => {
    const lines = Array.from({ length: ROSTER_ROWS_MAX + 1 }, (_, i) => ["P", String(i % 999), "M"]);
    expect(parseRosterCsv(csv(["Name", "Number", "Size"], ...lines))).toMatchObject({ ok: false, needsMapping: false });
  });
  it("takes a file without a header when told to", () => {
    const result = parseRosterCsv(csv(["Ana", "9", "M"]), { header: false, mapping: { name: 0, number: 1, sizeLabel: 2 } });
    expect(result.ok && result.rows).toHaveLength(1);
  });
});
