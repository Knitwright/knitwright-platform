import { describe, expect, it } from "vitest";
import { MAX_VERSION, exportParamsSchema, exportQuerySchema } from "./request";

const UUID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

describe("the address of an export", () => {
  it("takes a design id and one of three formats", () => {
    for (const format of ["pdf", "xlsx", "svg"]) {
      expect(exportParamsSchema.parse({ projectId: UUID, format })).toEqual({ projectId: UUID, format });
    }
  });

  it("refuses an id that is not a uuid, and any other format", () => {
    expect(exportParamsSchema.safeParse({ projectId: "1", format: "pdf" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ projectId: `${UUID}x`, format: "pdf" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ projectId: UUID, format: "docx" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ projectId: UUID, format: "PDF" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ projectId: UUID, format: ["pdf"] }).success).toBe(false);
  });
});

describe("the query of an export", () => {
  const parse = (format: "pdf" | "xlsx" | "svg", query: unknown) => exportQuerySchema(format).safeParse(query);

  it("needs a view for an SVG, and only front or back", () => {
    expect(parse("svg", {}).success).toBe(false);
    expect(parse("svg", { view: "side" }).success).toBe(false);
    expect(parse("svg", { view: "front" })).toMatchObject({ success: true, data: { view: "front" } });
    expect(parse("svg", { view: "back" })).toMatchObject({ success: true, data: { view: "back" } });
  });

  it("refuses a view for a PDF or an Excel file", () => {
    expect(parse("pdf", { view: "front" }).success).toBe(false);
    expect(parse("xlsx", { view: "back" }).success).toBe(false);
    expect(parse("pdf", {})).toMatchObject({ success: true, data: {} });
  });

  it("reads a version as a whole number from 1 to the limit", () => {
    expect(parse("pdf", { version: "3" })).toMatchObject({ success: true, data: { version: 3 } });
    expect(parse("pdf", { version: String(MAX_VERSION) }).success).toBe(true);
    for (const bad of ["0", "-1", "1.5", "abc", "", "1e3", " 3", "0x10", String(MAX_VERSION + 1), "99999999999999999999", ["1", "2"]]) {
      expect(parse("pdf", { version: bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("passes a colourway id on, and refuses one that is too long or not text", () => {
    expect(parse("pdf", { colourway: "away" })).toMatchObject({ success: true, data: { colourway: "away" } });
    expect(parse("pdf", { colourway: "x".repeat(200) }).success).toBe(false);
    expect(parse("pdf", { colourway: ["a", "b"] }).success).toBe(false);
  });

  it("refuses a query it does not know, so a typo is not ignored", () => {
    expect(parse("pdf", { versoin: "3" }).success).toBe(false);
  });
});
