import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { fullDesign, packFor } from "../fixtures/designs";
import type { TechPack } from "../types";
import { ExportRefused } from "./errors";
import { buildWorkbook } from "./excel/workbook";
import { assertEverySetCellHasSource } from "./guard";
import { buildPdf } from "./pdf/document";
import { buildSvg } from "./svg";

/** The last guard before any file is written. The types already forbid these documents, so each is made by force. */
const broken = (patch: (pack: TechPack) => unknown): TechPack => patch(packFor(fullDesign("crew-tee")) as TechPack) as TechPack;

describe("the last guard before a file is written", () => {
  it("lets every document pass that the builder makes, empty and full", () => {
    expect(() => assertEverySetCellHasSource(packFor(start("crew-tee")))).not.toThrow();
    expect(() => assertEverySetCellHasSource(packFor(fullDesign("team-jersey")))).not.toThrow();
  });

  it("refuses a set cell that has no source", () => {
    const pack = broken((p) => ({ ...p, cover: { ...p.cover, styleNumber: { status: "set", value: "CP-7" } } }));
    expect(() => assertEverySetCellHasSource(pack)).toThrow(ExportRefused);
    expect(() => assertEverySetCellHasSource(pack)).toThrow(/cover\.styleNumber/);
  });

  it("refuses a source that is not one of the known sources", () => {
    const pack = broken((p) => ({ ...p, cover: { ...p.cover, season: { status: "set", value: "SS27", provenance: "verified" } } }));
    expect(() => assertEverySetCellHasSource(pack)).toThrow(/cover\.season/);
  });

  it("refuses a set cell with no value or an empty one", () => {
    const empty = broken((p) => ({ ...p, cover: { ...p.cover, season: { status: "set", value: "", provenance: "user-edited" } } }));
    const missing = broken((p) => ({ ...p, cover: { ...p.cover, season: { status: "set", provenance: "user-edited" } } }));
    expect(() => assertEverySetCellHasSource(empty)).toThrow(ExportRefused);
    expect(() => assertEverySetCellHasSource(missing)).toThrow(ExportRefused);
  });

  it("refuses a cell that says anything other than set or to be confirmed", () => {
    const pack = broken((p) => ({ ...p, cover: { ...p.cover, season: { status: "verified", value: "x", provenance: "user-edited" } } }));
    expect(() => assertEverySetCellHasSource(pack)).toThrow(ExportRefused);
  });

  it("refuses a to-be-confirmed cell that holds a value, so a guess cannot hide in it", () => {
    const pack = broken((p) => ({ ...p, cover: { ...p.cover, season: { status: "to-be-confirmed", value: "0" } } }));
    expect(() => assertEverySetCellHasSource(pack)).toThrow(/cover\.season/);
  });

  it("refuses a length or a number that is not a finite number", () => {
    const length = broken((p) => ({
      ...p,
      measurements: {
        ...p.measurements,
        groups: p.measurements.groups.map((group, index) =>
          index > 0
            ? group
            : {
                ...group,
                rows: group.rows.map((row, at) =>
                  at > 0 ? row : { ...row, values: [{ status: "set", value: "1", provenance: "user-edited", tenthsMm: Number.NaN }] },
                ),
              },
        ),
      },
    }));
    expect(() => assertEverySetCellHasSource(length)).toThrow(/tenthsMm/);
  });

  it("refuses a value that sits outside a cell, with no source at all", () => {
    const pack = broken((p) => ({ ...p, cover: { ...p.cover, extra: { value: "12 pieces" } } }));
    expect(() => assertEverySetCellHasSource(pack)).toThrow(/cover\.extra/);
  });
});

describe("every format runs the guard before it writes anything (R14)", () => {
  const noSource = () => broken((p) => ({ ...p, cover: { ...p.cover, styleNumber: { status: "set", value: "CP-7" } } }));

  it("refuses to write the Excel file, the PDF and the SVG from a document with a value that has no source", async () => {
    await expect(buildWorkbook(noSource())).rejects.toThrow(ExportRefused);
    await expect(buildPdf(noSource(), new Map())).rejects.toThrow(ExportRefused);
    expect(() => buildSvg(noSource(), "front", new Map())).toThrow(ExportRefused);
  });
});
