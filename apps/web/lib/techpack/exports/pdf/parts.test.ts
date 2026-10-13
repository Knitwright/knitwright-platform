import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { readPages } from "../fixtures/pdf-pages";
import { drawable } from "../pdf-text";
import type { ExportTable } from "../tables";
import { lengthColumn, table, text, textColumn, valueColumn, value, length } from "../table-types";
import { PROVENANCE_LABELS } from "@/lib/garment";
import { ExportRefused } from "../errors";
import type { SourceMarks } from "./marks";
import { dataTable } from "./parts";

const MARKS: SourceMarks = new Map([
  [PROVENANCE_LABELS["user-edited"], "1"],
  [PROVENANCE_LABELS["suggested-chart"], "2"],
]);

const longTable = (rows: number): ExportTable =>
  table(
    "Long",
    [textColumn("HEADCOLUMN"), valueColumn("VALUECOLUMN"), lengthColumn("LENGTHCOLUMN")],
    Array.from({ length: rows }, (_, index) => [
      text(`row ${index}`),
      value({ status: "set", value: `value ${index}`, provenance: "user-edited" }),
      length({ status: "set", value: "5.2", tenthsMm: 520, provenance: "suggested-chart" }),
    ]),
  );

const render = async (content: ReturnType<typeof dataTable>) => {
  registerPdfFont();
  const bytes = await renderToBuffer(h(Document, {}, h(Page, { size: "A4", style: { fontFamily: PDF_FONT_FAMILY, padding: 36 } }, content)));
  return readPages(new Uint8Array(bytes));
};

describe("a table in the PDF", () => {
  it("runs onto more pages when it is long, repeats its header row at the top of each, and never splits a row", async () => {
    const pages = await render(dataTable(longTable(70), drawable, MARKS));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages) expect(page.text, `page ${page.number}`).toContain("HEADCOLUMN VALUECOLUMN LENGTHCOLUMN");
    const whole = pages.flatMap((page) => [...page.text.matchAll(/row (\d+) value \1 \[1\] 5\.2 cm \[2\]/g)]);
    expect(whole).toHaveLength(70);
  });

  it("does not repeat the header on a page the table does not reach", async () => {
    const pages = await render(dataTable(longTable(3), drawable, MARKS));
    expect(pages).toHaveLength(1);
    expect(pages[0]?.text.split("HEADCOLUMN").length - 1).toBe(1);
  });

  it("refuses a value whose source has no mark in the key, so no value is printed without its source", () => {
    const onlyTyped: SourceMarks = new Map([[PROVENANCE_LABELS["user-edited"], "1"]]);
    expect(() => dataTable(longTable(1), drawable, onlyTyped)).toThrow(ExportRefused);
  });
});
