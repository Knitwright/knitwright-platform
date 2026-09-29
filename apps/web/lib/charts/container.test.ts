import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { sheetKind } from "./container";
import { CHART_IMPORT_LIMITS } from "./limits";

const spreadsheetParts = (extra: Record<string, Uint8Array> = {}): Record<string, Uint8Array> => ({
  "[Content_Types].xml": strToU8("<Types/>"),
  "xl/workbook.xml": strToU8("<workbook/>"),
  ...extra,
});

const zip = (files: Record<string, Uint8Array>): Uint8Array => zipSync(files, { level: 9 });

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
  });
});
