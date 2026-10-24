import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { SAMPLE_SHEET_INPUT } from "./fixtures";
import { buildSheet } from "./model";
import { factorySheetPdf } from "./pdf";

/** The SHA-256 of the sample batch's factory sheet. Changes only when the sheet's content or layout changes on purpose: update it with the change and say why in the commit. */
const SAMPLE_SHEET_SHA256 = "fa958ae81f2d7c925de472d61ac1e73258ef7c588db3c5f713d16e63ce4f870d";

describe("factorySheetPdf", () => {
  it("reads back with the orders, sizes, names, packing and due date", async () => {
    const facts = await readPdf(await factorySheetPdf(buildSheet(SAMPLE_SHEET_INPUT)));
    expect(facts.startsAsPdf).toBe(true);
    for (const expected of ["Factory sheet: team-jersey", "STORE-1001", "Northside Cricket Club", "OKAFOR", "Pieces by size", "Packing", "Due date: Not set", "Knitwright default, not agreed with a factory"]) {
      expect(facts.text, expected).toContain(expected);
    }
  }, 30_000);

  it("gives the same bytes twice, and the sample's recorded hash", async () => {
    const [a, b] = [await factorySheetPdf(buildSheet(SAMPLE_SHEET_INPUT)), await factorySheetPdf(buildSheet(SAMPLE_SHEET_INPUT))];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(createHash("sha256").update(a).digest("hex")).toBe(SAMPLE_SHEET_SHA256);
  }, 30_000);

  it("shows a character the font lacks as a question mark instead of garbling the line", async () => {
    const input = { ...SAMPLE_SHEET_INPUT, orders: [{ ...SAMPLE_SHEET_INPUT.orders[0]!, brandName: "A中B" }] };
    expect((await readPdf(await factorySheetPdf(buildSheet(input)))).text).toContain("A?B");
  }, 30_000);
});
