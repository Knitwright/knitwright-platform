import { strToU8, zipSync } from "fflate";
import writeExcelFile from "write-excel-file/node";
import { describe, expect, it } from "vitest";
import { sheetKind } from "./container";
import { CHART_IMPORT_LIMITS } from "./limits";

const spreadsheetParts = (extra: Record<string, Uint8Array> = {}): Record<string, Uint8Array> => ({
  "[Content_Types].xml": strToU8("<Types/>"),
  "xl/workbook.xml": strToU8("<workbook/>"),
  ...extra,
});

const zip = (files: Record<string, Uint8Array>): Uint8Array => zipSync(files, { level: 9 });

// These build and unpack 40 MB archives (a zip bomb), which is slow under coverage on a shared runner.
const BOMB_MS = 30_000;

describe("sheetKind", () => {
  it("knows a spreadsheet by its content, not its name", () => {
    expect(sheetKind(zip(spreadsheetParts()))).toEqual({ ok: true, kind: "xlsx" });
  });

  it("reads anything else that is text as CSV, without the byte order mark", () => {
    const bytes = strToU8("﻿Point,S\nChest,50\n");
    expect(sheetKind(bytes)).toEqual({ ok: true, kind: "csv", text: "Point,S\nChest,50\n" });
  });

  it("refuses an empty file", () => {
    expect(sheetKind(new Uint8Array())).toMatchObject({ ok: false, message: expect.stringMatching(/empty/) });
  });

  it("refuses a file over the size limit before looking inside", () => {
    const bytes = new Uint8Array(CHART_IMPORT_LIMITS.maxBytes + 1).fill(65);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/too large/) });
  });

  it("refuses the old Excel format and says what to save as instead", () => {
    const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/\.xlsx/) });
  });

  it("refuses bytes that are not text", () => {
    expect(sheetKind(new Uint8Array([0x41, 0x00, 0x42]))).toMatchObject({ ok: false });
    expect(sheetKind(new Uint8Array([0xff, 0xfe, 0xfd]))).toMatchObject({ ok: false });
  });

  it("refuses a zip archive that is not a spreadsheet", () => {
    expect(sheetKind(zip({ "a.txt": strToU8("hello") }))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/not a spreadsheet/),
    });
  });

  it("refuses a zip archive that is cut short", () => {
    const whole = zip(spreadsheetParts());
    expect(sheetKind(whole.slice(0, whole.length - 10))).toMatchObject({ ok: false });
  });

  it("refuses an archive with too many parts", () => {
    const many = Object.fromEntries(
      Array.from({ length: CHART_IMPORT_LIMITS.maxZipEntries }, (_, index) => [`xl/p${index}.xml`, strToU8("x")]),
    );
    expect(sheetKind(zip(spreadsheetParts(many)))).toMatchObject({ ok: false, message: expect.stringMatching(/parts/) });
  });

  it("refuses an archive that would unpack to far more than it holds", () => {
    const bomb = new Uint8Array(4 * 1024 * 1024);
    expect(sheetKind(zip(spreadsheetParts({ "xl/worksheets/sheet1.xml": bomb })))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/unpack/),
    });
  });

  it("refuses an archive whose parts add up to more than allowed", () => {
    const random = (size: number): Uint8Array => {
      const bytes = new Uint8Array(size);
      let seed = 7;
      for (let index = 0; index < size; index += 1) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        bytes[index] = seed % 26 === 0 ? 65 : 66;
      }
      return bytes;
    };
    const parts = Object.fromEntries(
      Array.from({ length: 5 }, (_, index) => [`xl/big${index}.xml`, random(2 * 1024 * 1024)]),
    );
    const bytes = zip(spreadsheetParts(parts));
    expect(bytes.length).toBeLessThan(CHART_IMPORT_LIMITS.maxBytes);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/unpack/) });
    // Building and unpacking 10 MB takes about a second alone, and many times that with coverage
    // on a shared CI machine, past the default five seconds.
  }, 30_000);
});

/**
 * The reader unpacks each part from the header in front of it, not from the table of contents
 * at the end. These archives have an honest table and a dishonest header.
 */
describe("sheetKind reads each part's own header against the table of contents", () => {
  const END_RECORD_LENGTH = 22;
  const viewOf = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const directoryStart = (bytes: Uint8Array): number => viewOf(bytes).getUint32(bytes.length - END_RECORD_LENGTH + 16, true);
  const directoryEntries = (bytes: Uint8Array): number[] => {
    const view = viewOf(bytes);
    const count = view.getUint16(bytes.length - END_RECORD_LENGTH + 10, true);
    const found: number[] = [];
    let at = directoryStart(bytes);
    for (let index = 0; index < count; index += 1) {
      found.push(at);
      at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    }
    return found;
  };
  const honest = (): Uint8Array => zip(spreadsheetParts({ "xl/worksheets/sheet1.xml": strToU8("<worksheet/>") }));

  it("still takes an archive whose headers agree with its table", () => {
    expect(sheetKind(honest())).toEqual({ ok: true, kind: "xlsx" });
  });

  it("refuses a part whose header says it unpacks to more than the table says", () => {
    const bytes = honest();
    viewOf(bytes).setUint32(22, 50 * 1024 * 1024, true);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/not a spreadsheet/) });
  });

  it("refuses a part whose sizes follow its data, with none in its header", () => {
    const bytes = honest();
    const view = viewOf(bytes);
    view.setUint16(6, view.getUint16(6, true) | 0x08, true);
    view.setUint32(18, 0, true);
    view.setUint32(22, 0, true);
    for (const entry of directoryEntries(bytes)) view.setUint16(entry + 8, view.getUint16(entry + 8, true) | 0x08, true);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/not a spreadsheet/) });
  });

  it("takes a workbook whose sizes follow each part's data, as the exports write it", async () => {
    const bytes = new Uint8Array(await writeExcelFile([[{ value: "Chest" }, { value: 50 }]]).toBuffer());
    expect(viewOf(bytes).getUint16(6, true) & 0x08).toBe(0x08);
    expect(sheetKind(bytes)).toEqual({ ok: true, kind: "xlsx" });
  });

  it("refuses a part that unpacks to more than its header and its table both claim", () => {
    const bytes = zip(spreadsheetParts({ "xl/worksheets/sheet1.xml": new Uint8Array(40 * 1024 * 1024) }));
    const view = viewOf(bytes);
    const entry = directoryEntries(bytes).find((at) => view.getUint32(at + 24, true) === 40 * 1024 * 1024) ?? -1;
    const local = view.getUint32(entry + 42, true);
    view.setUint32(entry + 24, 1000, true);
    view.setUint32(local + 22, 1000, true);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/unpack/) });
  }, BOMB_MS);

  it("refuses a part hidden in front of the parts the table lists", () => {
    const bomb = zip({ "bomb.xml": new Uint8Array(40 * 1024 * 1024) });
    const hidden = bomb.subarray(0, directoryStart(bomb));
    const original = honest();
    const bytes = new Uint8Array(hidden.length + original.length);
    bytes.set(hidden, 0);
    bytes.set(original, hidden.length);
    const view = viewOf(bytes);
    const shift = (at: number): void => view.setUint32(at, view.getUint32(at, true) + hidden.length, true);
    shift(bytes.length - END_RECORD_LENGTH + 16);
    for (const entry of directoryEntries(bytes)) shift(entry + 42);
    expect(bytes.length).toBeLessThan(CHART_IMPORT_LIMITS.maxBytes);
    expect(sheetKind(bytes)).toMatchObject({ ok: false, message: expect.stringMatching(/not a spreadsheet/) });
  }, BOMB_MS);
});
