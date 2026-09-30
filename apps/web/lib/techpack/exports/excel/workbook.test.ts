import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PROVENANCE_LABELS, applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { action, typeIds } from "@/lib/garment/fixtures/arbitraries";
import { start } from "@/lib/garment/fixtures/specs";
import { TO_BE_CONFIRMED } from "../../cell";
import { CHARTS, PROJECT, TOPS_IDS, fullDesign, packFor, revisions } from "../../fixtures/designs";
import { PROPOSAL_WORDS } from "../../text";
import type { TechPack } from "../../types";
import { allCells } from "../../walk";
import { ILLUSTRATION_LABEL } from "@/lib/images/panel-state";
import { EXCEL_SHEETS } from "../contents";
import {
  pairsOf,
  readWorkbook,
  unzipText,
  worksheetXml,
  type Pair,
  type ReadSheet,
  type Value,
} from "../fixtures/xlsx-read";
import { textCell } from "./cells";
import { buildWorkbook, columnWidths, writeSheets } from "./workbook";

/**
 * How the file is compared with the document. Two rules of the writer are stated here and not hidden:
 * (1) characters that XML does not allow are removed, and (2) a string that is empty, or empty after
 * rule 1, is written as no cell, so it reads back as nothing. A carriage return reads back as a line feed.
 */
const XML_INVALID = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;
const expectedText = (text: string): string | null => {
  const written = text.replace(XML_INVALID, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  return written === "" ? null : written;
};

const sourceOf = (cell: Record<string, unknown>): string | null =>
  cell.status !== "set" ? null : cell.proposal === true ? PROPOSAL_WORDS : PROVENANCE_LABELS[cell.provenance as keyof typeof PROVENANCE_LABELS];

const valueOf = (cell: Record<string, unknown>): Value => {
  if (cell.status !== "set") return TO_BE_CONFIRMED;
  if (typeof cell.tenthsMm === "number") return cell.tenthsMm / 100;
  if (typeof cell.number === "number") return cell.number;
  return expectedText(cell.value as string);
};

const expectedPairs = (pack: TechPack): Pair[] =>
  allCells(pack).map(({ cell }) => ({ value: valueOf(cell), source: sourceOf(cell) }));

const key = (pair: Pair): string => JSON.stringify([pair.value, pair.source]);
const sorted = (pairs: readonly Pair[]): string[] => pairs.map(key).sort();

const readPairs = async (bytes: Uint8Array): Promise<{ sheets: readonly ReadSheet[]; pairs: Pair[] }> => {
  const sheets = await readWorkbook(bytes);
  const pairs = sheets.flatMap((sheet) => pairsOf(sheet)).filter((pair) => pair.value !== null || pair.source !== null);
  return { sheets, pairs };
};

const FORMULA = /<f[\s>/]/;

const designs = (): readonly (readonly [string, TechPack])[] =>
  TOPS_IDS.flatMap((typeId) => [
    [`${typeId} empty`, packFor(start(typeId))] as const,
    [`${typeId} empty, sizes from a chart`, packFor(start(typeId), { charts: CHARTS })] as const,
    [`${typeId} full`, packFor(fullDesign(typeId), { history: revisions(3) })] as const,
    [`${typeId} full, sizes from a chart`, packFor(fullDesign(typeId), { charts: CHARTS, history: revisions(10) })] as const,
  ]);

describe("the Excel file equals the document (T2)", () => {
  it("holds one sheet for each section that holds values, in order, with names Excel accepts", async () => {
    const sheets = await readWorkbook(await buildWorkbook(packFor(fullDesign("crew-tee"))));
    const names = sheets.map((sheet) => sheet.sheet);
    expect(names).toEqual(Object.values(EXCEL_SHEETS).filter((name): name is string => name !== null));
    expect(names).toEqual(["Cover", "Measurements", "Components", "Construction", "Colourways", "Artwork", "Labels and packing", "Suggested values", "Sign-off"]);
    for (const name of names) expect(name).toMatch(/^[^\\/?*[\]:]{1,31}$/);
  });

  it("adds a last sheet saying the AI illustrations are in the PDF, only when some were made", async () => {
    const illustrations = { label: ILLUSTRATION_LABEL, note: null, items: [{ view: "front" as const, caption: "Front.", src: "data:image/jpeg;base64,AAAA" }] };
    const sheets = await readWorkbook(await buildWorkbook(packFor(fullDesign("crew-tee")), { illustrations }));
    const last = sheets.at(-1);
    expect(last?.sheet).toBe("Illustrations");
    expect(last?.data.flat()).toEqual([ILLUSTRATION_LABEL, "The pictures (front) are in the PDF of this tech pack."]);
    const without = await readWorkbook(await buildWorkbook(packFor(fullDesign("crew-tee")), { illustrations: null }));
    expect(without.map((sheet) => sheet.sheet)).not.toContain("Illustrations");
  });

  it("holds every cell of the document with its value and its source, numbers as numbers, for every tops type", async () => {
    for (const [label, pack] of designs()) {
      const { pairs } = await readPairs(await buildWorkbook(pack));
      expect(sorted(pairs), label).toEqual(sorted(expectedPairs(pack)));
    }
  });

  it("writes each length as a number of centimetres and each other number as a number", async () => {
    const pack = packFor(fullDesign("crew-tee"), { charts: CHARTS });
    const { pairs } = await readPairs(await buildWorkbook(pack));
    const lengths = allCells(pack).filter(({ cell }) => typeof cell.tenthsMm === "number");
    expect(lengths.length).toBeGreaterThan(20);
    for (const { cell } of lengths) {
      expect(pairs.some((pair) => pair.value === (cell.tenthsMm as number) / 100 && typeof pair.value === "number")).toBe(true);
    }
    expect(pairs.filter((pair) => typeof pair.value === "number").length).toBe(
      allCells(pack).filter(({ cell }) => typeof cell.tenthsMm === "number" || typeof cell.number === "number").length,
    );
  });

  it("puts the unit in the header of each column of numbers", async () => {
    const sheets = await readWorkbook(await buildWorkbook(packFor(fullDesign("crew-tee"))));
    const headers = sheets.flatMap((sheet) => sheet.data.flat()).filter((cell): cell is string => typeof cell === "string");
    expect(headers).toContain("M (base size) (cm)");
    expect(headers).toContain("Tolerance (± cm)");
    expect(headers).toContain("Weight (grams per square metre)");
    expect(headers).toContain("Turn (degrees)");
  });

  it("writes to be confirmed as its words with nothing in the source cell", async () => {
    const pack = packFor(start("crew-tee"));
    const { pairs } = await readPairs(await buildWorkbook(pack));
    const missing = pairs.filter((pair) => pair.value === TO_BE_CONFIRMED);
    expect(missing.length).toBe(allCells(pack).filter(({ cell }) => cell.status !== "set").length);
    expect(missing.every((pair) => pair.source === null)).toBe(true);
  });

  it("holds the labels of the rows, the sizes and the groups", async () => {
    const pack = packFor(fullDesign("polo"), { charts: CHARTS });
    const text = new Set((await readWorkbook(await buildWorkbook(pack))).flatMap((sheet) => sheet.data.flat()));
    for (const group of pack.measurements.groups) {
      expect(text.has(group.label), group.label).toBe(true);
      for (const row of group.rows) {
        expect(text.has(row.label), row.label).toBe(true);
        expect(text.has(row.code), row.code).toBe(true);
      }
    }
    for (const seam of pack.construction.seams) expect(text.has(seam.label), seam.label).toBe(true);
    for (const line of pack.components.others) expect(text.has(line.label), line.label).toBe(true);
    for (const row of pack.labelling.rows) expect(text.has(row.label), row.label).toBe(true);
    expect(text.has(pack.signOff.statement)).toBe(true);
    expect(text.has(String(pack.cover.version))).toBe(true);
  });

  it("freezes the header row and makes it bold", async () => {
    const bytes = await buildWorkbook(packFor(fullDesign("crew-tee")));
    const files = unzipText(bytes);
    // The cover starts with a table that has no title, so its header is row 1. Measurements starts with a title.
    expect(files["xl/worksheets/sheet1.xml"]).toMatch(/<pane ySplit="1"[^>]*state="frozen"/);
    expect(files["xl/worksheets/sheet2.xml"]).toMatch(/<pane ySplit="2"[^>]*state="frozen"/);
    const styles = files["xl/styles.xml"] ?? "";
    const fonts = [...(/<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(styles)?.[1] ?? "").matchAll(/<font>([\s\S]*?)<\/font>|<font\/>/g)];
    const boldFonts = fonts.flatMap((font, index) => (/<b\/>/.test(font[0]) ? [index] : []));
    const xfs = [...(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "").matchAll(/<xf [^>]*?fontId="(\d+)"[^>]*?>/g)];
    const style = Number(/<c r="A1" s="(\d+)"/.exec(files["xl/worksheets/sheet1.xml"] ?? "")?.[1]);
    expect(boldFonts.length).toBeGreaterThan(0);
    expect(boldFonts).toContain(Number(xfs[style]?.[1]));
  });

  it("sets a width for every column, wide enough for its header", async () => {
    const files = unzipText(await buildWorkbook(packFor(fullDesign("crew-tee"))));
    for (const name of Object.keys(files).filter((file) => /worksheets\/sheet\d+\.xml$/.test(file))) {
      expect(files[name]).toMatch(/<cols>(<col [^>]*width="\d+(\.\d+)?"[^>]*\/>)+<\/cols>/);
    }
  });
});

describe("column widths", () => {
  it("are as wide as the longest text, with room to spare, between a least and a most", () => {
    const widths = columnWidths([["a", "b".repeat(20), "c".repeat(500)], ["a".repeat(12), null, 12.5]]);
    expect(widths).toEqual([{ width: 14 }, { width: 22 }, { width: 60 }]);
    expect(columnWidths([["x"]])).toEqual([{ width: 10 }]);
    expect(columnWidths([])).toEqual([]);
  });
});

/** Text that a spreadsheet program would run if it were stored as a formula. */
const HOSTILE = ["=1+1", "=cmd|' /C calc'!A0", "@SUM(A1)", "+1", "-2", "=HYPERLINK(\"http://x\",\"y\")", "-2+3", "@A1", "=", "+", "-"];

const withText = (text: string): GarmentSpec => {
  const steps: SpecAction[] = [
    { type: "set-labelling", field: "care", text, provenance: "user-edited" },
    { type: "add-artwork", artwork: { id: "hostile", name: text, source: { kind: "text", text }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 500, height: 500, rotationDegrees: 0, technique: "embroidery", provenance: "user-edited" } },
    { type: "update-fabric", fabric: { id: "main", name: text, composition: text, construction: text, weightGsm: 150, finish: text, consumption: text, stretch: "none", provenance: "user-edited", sources: {} } },
    { type: "update-colourway", colourway: { id: "main", name: text, colours: [{ panelId: "body-front", colour: text, swatch: "#112233", provenance: "user-edited" }] } },
  ];
  return steps.reduce((spec, step) => {
    const result = applyAction(spec, step);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, fullDesign("crew-tee"));
};

describe("a cell whose text starts with a formula character is stored as text (T3)", () => {
  it("reads back the same string and holds no formula element, for text in the design", async () => {
    for (const text of HOSTILE) {
      const pack = packFor(withText(text), { project: { ...PROJECT, name: text, styleNumber: text, season: text, brandName: text } });
      const bytes = await buildWorkbook(pack);
      const read = (await readWorkbook(bytes)).flatMap((sheet) => sheet.data.flat());
      expect(read.filter((cell) => cell === text).length, text).toBeGreaterThan(5);
      for (const xml of worksheetXml(bytes)) expect(xml, text).not.toMatch(FORMULA);
      const strings = unzipText(bytes)["xl/sharedStrings.xml"] ?? "";
      expect(strings, text).toContain(text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
      const { pairs } = await readPairs(bytes);
      expect(sorted(pairs), text).toEqual(sorted(expectedPairs(pack)));
    }
  });

  it("does the same for a cell made by hand, including text that starts with a tab or a carriage return", async () => {
    const texts = [...HOSTILE, "\t=1+1", "\r=1+1", "\t@SUM(A1)", "\r-2", " =1+1", "a\t=b"];
    const bytes = await writeSheets([{ name: "Hostile", data: texts.map((text) => [textCell(text)]), columns: [{ width: 20 }] }]);
    for (const xml of worksheetXml(bytes)) expect(xml).not.toMatch(FORMULA);
    const strings = unzipText(bytes)["xl/sharedStrings.xml"] ?? "";
    const read = (await readWorkbook(bytes))[0]?.data.map((row) => row[0]) ?? [];
    expect(read).toHaveLength(texts.length);
    texts.forEach((text, index) => {
      // The reader trims white space at both ends. The raw XML keeps the tab, so it is checked there too.
      expect(read[index], JSON.stringify(text)).toBe(text.replace(/^[\t\r ]+/, ""));
      // A carriage return is not kept in the XML text, so it is left out of the comparison.
      expect(strings, JSON.stringify(text)).toContain(text.replace(/\r/g, ""));
    });
    expect(/<c r="A\d+"[^>]* t="s"/.test(worksheetXml(bytes)[0] ?? "")).toBe(true);
  });

  it("writes every text cell as a shared string and never as a formula result or inline string", async () => {
    const bytes = await buildWorkbook(packFor(withText("=1+1")));
    for (const xml of worksheetXml(bytes)) {
      expect(xml).not.toMatch(/t="(str|inlineStr|e|b)"/);
      expect(xml).not.toContain("<is>");
    }
  });
});

describe("what the writer does to text, stated openly", () => {
  it("removes characters that XML does not allow, and reads an empty string as no cell", async () => {
    const bytes = await writeSheets([
      { name: "Rules", data: [[textCell("a\u0001b\u000bc")], [textCell("\u0001")], [textCell("x")]], columns: [{ width: 10 }] },
    ]);
    const data = (await readWorkbook(bytes))[0]?.data ?? [];
    expect(data[0]?.[0]).toBe("abc");
    expect(data[1]?.[0] ?? null).toBeNull();
    expect(data[2]?.[0]).toBe("x");
    expect(expectedText("a\u0001b\u000bc")).toBe("abc");
    expect(expectedText("\u0001")).toBeNull();
  });

  it("refuses two sheets with one name, and a name Excel does not allow", async () => {
    await expect(writeSheets([{ name: "A", data: [[textCell("x")]] }, { name: "A", data: [[textCell("y")]] }])).rejects.toThrow(/twice|again|same/i);
    await expect(writeSheets([{ name: "A/B", data: [[textCell("x")]] }])).rejects.toThrow(/A\/B/);
  });
});

describe("no value is written without its source (T5, invariant I5)", () => {
  it.each([1, 2, 3, 4])("holds for workbooks made from designs made by random changes, run %i", async (seed) => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...typeIds.slice(0, -1)), fc.array(action, { maxLength: 25 }), fc.boolean(), async (typeId, actions, withCharts) => {
        let spec: GarmentSpec = start(typeId);
        for (const next of actions) {
          const result = applyAction(spec, next);
          if (result.ok) spec = result.spec;
        }
        const pack = packFor(spec, withCharts ? { charts: CHARTS } : {});
        const bytes = await buildWorkbook(pack);
        const { pairs } = await readPairs(bytes);
        expect(sorted(pairs)).toEqual(sorted(expectedPairs(pack)));
        const valued = pairs.filter((pair) => pair.value !== TO_BE_CONFIRMED || pair.source !== null);
        expect(valued.every((pair) => typeof pair.source === "string" && pair.source.length > 0)).toBe(true);
        for (const xml of worksheetXml(bytes)) expect(xml).not.toMatch(FORMULA);
      }),
      { numRuns: 8, seed },
    );
  });

  it("holds in every column that has values: a value cell is never followed by an empty source unless it says to be confirmed", async () => {
    const pack = packFor(fullDesign("team-jersey"), { charts: CHARTS });
    const { pairs } = await readPairs(await buildWorkbook(pack));
    for (const pair of pairs) {
      if (pair.source === null) expect(pair.value).toBe(TO_BE_CONFIRMED);
    }
  });
});
