import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readChartFile } from "./read-sheet";

/** A minimal spreadsheet, written by hand so the test controls every cell. */
function workbook(sheetRows: string): Uint8Array {
  const files = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Chart" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  return zipSync(files);
}

const text = (ref: string, value: string): string => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const number = (ref: string, value: string): string => `<c r="${ref}"><v>${value}</v></c>`;

describe("readChartFile", () => {
  it("reads a spreadsheet's first sheet as text, keeping numbers exactly as stored", async () => {
    const bytes = workbook(
      `<row r="1">${text("A1", "Point")}${text("B1", "S")}</row><row r="2">${text("A2", "Chest width")}${number("B2", "52.55")}</row>`,
    );
    expect(await readChartFile(bytes)).toEqual({
      ok: true,
      grid: [
        { line: 1, cells: ["Point", "S"] },
        { line: 2, cells: ["Chest width", "52.55"] },
      ],
    });
  });

  it("takes a formula cell's stored result as data and never works the formula out", async () => {
    const bytes = workbook(
      `<row r="1">${text("A1", "Point")}${text("B1", "S")}</row><row r="2">${text("A2", "Chest")}<c r="B2"><f>1+1</f><v>7</v></c></row>`,
    );
    const result = await readChartFile(bytes);
    expect(result).toMatchObject({ ok: true, grid: [{ cells: ["Point", "S"] }, { cells: ["Chest", "7"] }] });
  });

  it("reads a CSV file", async () => {
    expect(await readChartFile(strToU8("Point,S\nChest,50\n"))).toMatchObject({ ok: true, grid: [{ line: 1 }, { line: 2 }] });
  });

  it("refuses a file that is neither, without throwing", async () => {
    expect(await readChartFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toMatchObject({ ok: false });
  });

  it("refuses a spreadsheet the reader cannot make sense of, without throwing", async () => {
    const broken = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "xl/workbook.xml": strToU8("not xml at all <") });
    expect(await readChartFile(broken)).toMatchObject({ ok: false, message: expect.stringMatching(/could not be read/) });
  });
});
