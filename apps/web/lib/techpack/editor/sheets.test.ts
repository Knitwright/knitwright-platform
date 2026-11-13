import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { article, emptyHeader, header, input } from "../view/fixtures/views";
import { buildTechPackView } from "../view/model";
import { buildSheets, NEEDS_INPUT, SHEET_IDS, SHEET_NAMES, sheetsFileName, type SheetsInput } from "./sheets";
import { buildSheetsWorkbook } from "./workbook";

const sheetsInput = (patch: Partial<SheetsInput> = {}): SheetsInput => ({
  view: buildTechPackView(input({ unit: "cm" })),
  header: header(),
  article: article(),
  date: "13 Nov 2026",
  openIn: "https://knitwright.test/studio/1/tech-pack",
  ...patch,
});

describe("the eight sheets", () => {
  it("are the eight screen 31 names, in order, under one shared header", () => {
    const { sheets, header: shared } = buildSheets(sheetsInput());
    expect(sheets.map((entry) => entry.name)).toEqual(["Overview", "Colourways", "Measurements", "Size chart", "Callouts", "Materials", "Artworks", "Labels"]);
    expect(SHEET_IDS.map((id) => SHEET_NAMES[id])).toEqual(sheets.map((entry) => entry.name));
    expect(shared.rows.map(([label]) => label)).toEqual(["Brand", "Style name", "Style code", "Season / collection", "Base product", "Sample size", "Size range", "Date"]);
    expect(shared.rows).toContainEqual(["Size range", "XS – 3XL"]);
    expect(shared.rows).toContainEqual(["Base product", "JSY-SS-01 (Class A)"]);
    expect(shared.openIn).toContain("/tech-pack");
  });

  it("carry the graded size chart from the base article, sample size highlighted, in the chosen unit", () => {
    const chart = buildSheets(sheetsInput()).sheets.find((entry) => entry.id === "size-chart")?.blocks[0];
    expect(chart?.title).toBe("Size chart (CM) · garment measurements");
    expect(chart?.columns.slice(0, 3)).toEqual(["Label", "Point of measure", "Tol ±"]);
    expect(chart?.highlight).toBe(chart?.columns.indexOf("M"));
    const chest = chart?.rows.find((row) => row[0] === "A");
    expect(chest?.[chart?.columns.indexOf("M") ?? 0]).toBe("52.0");
    expect(chest?.[2]).toBe("1.0");
  });

  it("asks for what nobody has given, and never fills it in", () => {
    const { header: shared, sheets } = buildSheets(sheetsInput({ header: emptyHeader(), article: null, view: buildTechPackView(input({ header: emptyHeader(), article: null })) }));
    expect(shared.rows).toContainEqual(["Brand", NEEDS_INPUT]);
    expect(shared.rows).toContainEqual(["Base product", NEEDS_INPUT]);
    expect(shared.rows).toContainEqual(["Sample size", "Set by Knitwright QC"]);
    const overview = sheets[0]?.blocks.flatMap((entry) => entry.rows) ?? [];
    expect(overview).toContainEqual(["Factory", "Set by Knitwright QC"]);
    expect(overview).toContainEqual(["Style name", NEEDS_INPUT]);
  });

  it("names the file by the style code", () => {
    expect(sheetsFileName(header())).toBe("ROVERS-FC_ROVERS-HOME-SHIRT_techpack.xlsx");
    expect(sheetsFileName(emptyHeader())).toBe("design_techpack.xlsx");
    expect(sheetsFileName({ ...emptyHeader(), styleName: "Away kit" })).toBe("Away-kit_techpack.xlsx");
  });
});

describe("the eight-sheet .xlsx", () => {
  it("writes eight named sheets, each with the shared header, the same bytes every time", async () => {
    const sheets = buildSheets(sheetsInput());
    const bytes = await buildSheetsWorkbook(sheets);
    const again = await buildSheetsWorkbook(sheets);
    expect(Buffer.from(bytes).equals(Buffer.from(again))).toBe(true);
    const files = unzipSync(bytes);
    const book = strFromU8(files["xl/workbook.xml"] as Uint8Array);
    for (const name of ["Overview", "Colourways", "Measurements", "Size chart", "Callouts", "Materials", "Artworks", "Labels"]) expect(book).toContain(`name="${name}"`);
    const shared = strFromU8(files["xl/sharedStrings.xml"] as Uint8Array);
    expect(shared).toContain("Open in Knitwright");
    expect(shared).toContain("Rovers FC");
    expect(shared).not.toMatch(/<f>/);
  });
});
