import { describe, expect, it } from "vitest";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, TOPS_IDS, fullDesign, packFor, revisions } from "../fixtures/designs";
import type { TechPack } from "../types";
import { leaves } from "../walk";
import { buildWorkbook } from "./excel/workbook";
import { allText } from "./fixtures/pdf-pages";
import { readPdfOf } from "./fixtures/pdf-helpers";
import { readWorkbook, type ReadSheet, type Value } from "./fixtures/xlsx-read";
import { buildPdf } from "./pdf/document";
import { buildSvg } from "./svg";

/**
 * The formats agree with each other and with the document (M3), and hold nothing the document does
 * not hold (T11).
 */

const spec = (): GarmentSpec => designWith("crew-tee", {}, madeUpForType("crew-tee", {}));

const withChest = (base: GarmentSpec, value: number): GarmentSpec => {
  const result = applyAction(base, { type: "set-measurement", pointId: "chest-width", value, provenance: "user-edited" });
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

/** The number under a header, in the row that starts with this code and label, in one table of a sheet. */
function numberInRow(sheet: ReadSheet | undefined, code: string, label: string, header: string): Value {
  const rows = sheet?.data ?? [];
  const at = rows.findIndex((row) => row[0] === code && row[1] === label);
  for (let index = at; index >= 0; index -= 1) {
    const column = rows[index]?.indexOf(header) ?? -1;
    if (column >= 0) return rows[at]?.[column] ?? null;
  }
  return null;
}

describe("a measurement changes the PDF, the Excel file and the SVG together, to the same value (T6, M3)", () => {
  const oldSpec = spec();
  const newSpec = withChest(oldSpec, 5600);
  const oldPack = packFor(oldSpec);
  const newPack = packFor(newSpec);

  it.each([
    ["before", oldPack, "52.0", 52],
    ["after", newPack, "56.0", 56],
  ] as const)("holds the same value in all three formats %s the change", async (_when, pack, text, number) => {
    const { pages } = await readPdfOf(pack);
    const pdf = allText(pages);
    expect(pdf).toContain(`A Chest width To be confirmed ${text} cm`);
    const sheet = (await readWorkbook(await buildWorkbook(pack))).find((entry) => entry.sheet === "Measurements");
    expect(numberInRow(sheet, "A", "Chest width", "Size not set (cm)")).toBe(number);
    // The drawings carry the code of the row in a mark, and the value only in the table.
    for (const view of ["front", "back"] as const) {
      const svg = buildSvg(pack, view, new Map());
      expect(svg).toContain(">A</text>");
      expect(svg).not.toContain(`${text} cm`);
    }
  });

  it("changes each format, and no other measurement", async () => {
    const [before, after] = await Promise.all([buildWorkbook(oldPack), buildWorkbook(newPack)]);
    const read = async (bytes: Uint8Array) => (await readWorkbook(bytes)).find((entry) => entry.sheet === "Measurements");
    const [oldSheet, newSheet] = await Promise.all([read(before), read(after)]);
    const differing = (oldSheet?.data ?? []).flatMap((row, index) => (JSON.stringify(row) === JSON.stringify(newSheet?.data[index]) ? [] : [row[1]]));
    expect(differing).toEqual(["Chest width"]);
    expect(buildSvg(oldPack, "front", new Map())).not.toBe(buildSvg(newPack, "front", new Map()));
  });
});

describe("no value is held that the document does not hold (T11)", () => {
  /** Groups of digits in these strings and numbers. */
  const digitsIn = (values: readonly (string | number)[]): Set<string> =>
    new Set(values.flatMap((value) => String(value).match(/\d+/g) ?? []));

  const allowed = (pack: TechPack): Set<string> => {
    const held = digitsIn(leaves(pack).map((entry) => entry.leaf));
    // A length is written to Excel as a number of centimetres, worked from the stored tenths of a millimetre.
    const lengths = JSON.stringify(pack).match(/"tenthsMm":(\d+)/g) ?? [];
    for (const found of lengths) for (const digit of digitsIn([Number(found.split(":")[1]) / 100])) held.add(digit);
    return held;
  };

  const extra = (found: Iterable<string>, ok: Set<string>): string[] => [...found].filter((digit) => !ok.has(digit));

  const packs = (): readonly (readonly [string, TechPack])[] =>
    TOPS_IDS.flatMap((typeId) => [
      [`${typeId} empty`, packFor(start(typeId))] as const,
      [`${typeId} full`, packFor(fullDesign(typeId), { charts: CHARTS, history: revisions(4) })] as const,
    ]);

  it("holds for the Excel file, for every tops type", async () => {
    for (const [label, pack] of packs()) {
      const sheets = await readWorkbook(await buildWorkbook(pack));
      const found = digitsIn(sheets.flatMap((sheet) => sheet.data.flat()).filter((cell): cell is string | number => typeof cell === "string" || typeof cell === "number"));
      expect(extra(found, allowed(pack)), label).toEqual([]);
    }
  });

  it("holds for the text of the SVG files, for every tops type", () => {
    for (const [label, pack] of packs()) {
      for (const view of ["front", "back"] as const) {
        const svg = buildSvg(pack, view, new Map());
        const words = [...svg.matchAll(/<(?:text|title|desc)[^>]*>([^<]*)</g)].map((match) => match[1] ?? "");
        expect(extra(digitsIn(words), allowed(pack)), `${label} ${view}`).toEqual([]);
      }
    }
  });

  it.each([
    ["crew-tee", "empty"],
    ["team-jersey", "full"],
  ] as const)("holds for the PDF, apart from the page numbers: %s %s", async (typeId, kind) => {
    const pack = kind === "empty" ? packFor(start(typeId)) : packFor(fullDesign(typeId), { charts: CHARTS, history: revisions(4) });
    const { pages } = await readPdfOf(pack);
    const pageNumbers = new Set(pages.flatMap((page) => [String(page.number), String(pages.length)]));
    const found = digitsIn([allText(pages)]);
    expect(extra(found, new Set([...allowed(pack), ...pageNumbers]))).toEqual([]);
  });

  it("would notice a number that the document does not hold", () => {
    const pack = packFor(start("crew-tee"));
    expect(extra(["987654"], allowed(pack))).toEqual(["987654"]);
  });
});

describe("one full design exports in every format within 30 seconds (T4)", () => {
  it("builds the PDF, the Excel file and both SVG files, and says how long each took", async () => {
    const pack = packFor(fullDesign("team-jersey"), { charts: CHARTS, history: revisions(10) });
    const timed = async <T,>(work: () => Promise<T> | T): Promise<number> => {
      const started = performance.now();
      await work();
      return performance.now() - started;
    };
    const took = {
      pdf: await timed(() => buildPdf(pack, new Map())),
      xlsx: await timed(() => buildWorkbook(pack)),
      svgFront: await timed(() => buildSvg(pack, "front", new Map())),
      svgBack: await timed(() => buildSvg(pack, "back", new Map())),
    };
    const total = Object.values(took).reduce((sum, ms) => sum + ms, 0);
    process.stdout.write(`\nexport times (ms): ${JSON.stringify(Object.fromEntries(Object.entries(took).map(([k, v]) => [k, Math.round(v)])))}\n`);
    expect(total).toBeLessThan(30_000);
  });
});
