import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, fullDesign, packFor } from "../../fixtures/designs";
import { exportSections } from "../tables";
import { A4, MARGIN } from "./styles";
import { classColumn, classed, length, lengthColumn, table, text, textColumn, value, valueColumn } from "../table-types";
import { KEPT_SECTION_POINTS, KEPT_TABLE_POINTS, keepsSectionWhole, keepsTableWhole, sectionHeight, tableHeight } from "./keep";

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => [text(`row ${index}`), value({ status: "set", value: "some value", provenance: "user-edited" })]);

const columns = [textColumn("Name"), valueColumn("Value")];

describe("which tables are kept whole on a page", () => {
  it("keeps a short table whole and lets a long one run onto the next page", () => {
    expect(keepsTableWhole(table("Short", columns, rows(5)))).toBe(true);
    expect(keepsTableWhole(table("Long", columns, rows(200)))).toBe(false);
  });

  it("lets a table run on when one cell holds a great deal of text, however few rows there are", () => {
    const big = [[text("a"), value({ status: "set", value: "word ".repeat(2000), provenance: "user-edited" })]];
    expect(keepsTableWhole(table(null, columns, big))).toBe(false);
    expect(keepsTableWhole(table(null, [textColumn("A")], [[text("x".repeat(20000))]]))).toBe(false);
  });

  it("counts a table with only a heading and a sentence as a few lines, and an empty one as none", () => {
    expect(tableHeight(table("Heading", [textColumn("A")], [], "One sentence."))).toBeLessThan(60);
    expect(tableHeight(table(null, [lengthColumn("A")], []))).toBe(0);
  });

  it("counts a value and the short mark of its source on one line, as tall as the value alone", () => {
    const plain = table(null, [textColumn("A"), textColumn("B")], [[text("Chest"), text("52.0 cm")]]);
    const sourced = table(null, [textColumn("A"), valueColumn("B")], [[text("Chest"), value({ status: "set", value: "52.0 cm", provenance: "user-edited" })]]);
    expect(tableHeight(sourced)).toBe(tableHeight(plain));
  });

  it("counts a missing value by its words, which may wrap in a narrow column, so it is never shorter than a length", () => {
    const narrow = (cell: Parameters<typeof length>[0]) =>
      table(null, [textColumn("A"), ...Array.from({ length: 7 }, (_, index) => lengthColumn(`L${index}`))], [[text("x"), ...Array.from({ length: 7 }, () => length(cell))]]);
    const missing = narrow({ status: "to-be-confirmed" });
    const set = narrow({ status: "set", value: "52.0", tenthsMm: 5200, provenance: "user-edited" });
    expect(tableHeight(missing)).toBeGreaterThan(tableHeight(set));
  });

  it("makes a table with many narrow columns taller than one with few, for the same words", () => {
    const wide = table(null, [textColumn("A"), textColumn("B")], [[text("y".repeat(60)), text("z")]]);
    const narrow = table(null, Array.from({ length: 8 }, (_, index) => textColumn(`C${index}`)), [[text("y".repeat(60)), ...Array.from({ length: 7 }, () => text("z"))]]);
    expect(tableHeight(narrow)).toBeGreaterThan(tableHeight(wide));
  });

  it("leaves the explanation of a class out of the row, because the appendix says it once", () => {
    const cell = (explanation: string) => ({ status: "set" as const, value: "Lockstitch", provenance: "derived" as const, iso: "301", explanation, proposal: true });
    const row = (explanation: string) => table(null, [classColumn("A"), classColumn("B")], [[classed(cell(explanation)), classed(cell(explanation))]]);
    expect(tableHeight(row("word ".repeat(40)))).toBe(tableHeight(row("short")));
  });

  it("never keeps the flats whole, because they start a page of their own", () => {
    const flats = exportSections(packFor(fullDesign("crew-tee"))).find((section) => section.id === "flats");
    expect(flats && keepsSectionWhole(flats)).toBe(false);
  });

  it("keeps a small section whole and lets a large one run on, for real documents", () => {
    const sections = exportSections(packFor(fullDesign("polo"), { charts: CHARTS }));
    const kept = (id: string) => sections.filter((section) => section.id === id).map(keepsSectionWhole)[0];
    expect(kept("sign-off")).toBe(true);
    expect(kept("labelling")).toBe(true);
    // With a short mark in place of the source words, the seams of a polo fit in one block.
    expect(kept("construction")).toBe(true);
    expect(kept("how-to-measure")).toBe(false);
    for (const section of sections) expect(sectionHeight(section)).toBeGreaterThan(0);
  });

  it("holds what is kept whole to well under a page, in real documents", () => {
    expect(KEPT_SECTION_POINTS).toBeLessThan(A4.height - MARGIN.top - MARGIN.bottom);
    expect(KEPT_TABLE_POINTS).toBeLessThan(KEPT_SECTION_POINTS);
    for (const pack of [packFor(start("crew-tee")), packFor(fullDesign("team-jersey"), { charts: CHARTS })]) {
      for (const section of exportSections(pack)) {
        for (const kept of section.tables.filter(keepsTableWhole)) expect(tableHeight(kept)).toBeLessThanOrEqual(KEPT_TABLE_POINTS);
        if (keepsSectionWhole(section)) expect(sectionHeight(section)).toBeLessThanOrEqual(KEPT_SECTION_POINTS);
      }
    }
  });
});
