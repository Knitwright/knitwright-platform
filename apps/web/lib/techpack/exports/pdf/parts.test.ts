import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { readPages } from "../fixtures/pdf-pages";
import { drawable } from "../pdf-text";
import type { ExportTable } from "../tables";
import { lengthColumn, table, text, textColumn, valueColumn, value, length } from "../table-types";
import { dataTable } from "./parts";

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
    const pages = await render(dataTable(longTable(70), drawable));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages) expect(page.text, `page ${page.number}`).toContain("HEADCOLUMN VALUECOLUMN LENGTHCOLUMN");
    const whole = pages.flatMap((page) => [...page.text.matchAll(/row (\d+) value \1 Typed in by you 5\.2 cm Suggested from a size chart/g)]);
    expect(whole).toHaveLength(70);
  });

  it("does not repeat the header on a page the table does not reach", async () => {
    const pages = await render(dataTable(longTable(3), drawable));
    expect(pages).toHaveLength(1);
    expect(pages[0]?.text.split("HEADCOLUMN").length - 1).toBe(1);
  });
});
