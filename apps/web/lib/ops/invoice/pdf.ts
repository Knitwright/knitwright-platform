import { Document, Font, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { drawable } from "@/lib/techpack/exports/pdf-text";
import { DCTS_NOTE, type InvoiceModel } from "./model";

const INK = "#0f1012";
const MUTED = "#62656d";
const LINE = "#d9d9dd";
const ATTENTION = "#9a3412";

/** Fixed, so the same invoice always gives the same file. */
const CREATED = new Date(Date.UTC(2000, 0, 1));

let hyphenationOff = false;

const text = (value: string, style: Record<string, unknown> = {}, key?: string): ReactElement =>
  h(Text, { key, style: { fontFamily: PDF_FONT_FAMILY, fontSize: 9, color: INK, ...style } }, drawable(value));

const row = (key: string, cells: readonly string[], widths: readonly string[], bold = false): ReactElement =>
  h(
    View,
    { key, wrap: false, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE } },
    ...cells.map((c, i) => text(c, { width: widths[i] ?? "10%", fontSize: bold ? 9.5 : 9, paddingVertical: 2, paddingRight: 4 }, `${key}${i}`)),
  );

const heading = (value: string): ReactElement => text(value, { fontSize: 12, marginTop: 16, marginBottom: 4 });

/** Minor units with their currency, or the words that say nothing was given. */
export const money = (minor: number | null, currency: string | null): string =>
  minor === null || currency === null ? "Not stated" : `${currency} ${(minor / 100).toFixed(2)}`;

const NOT_ON_FILE = "Not on file";

function linesTable(invoice: InvoiceModel): ReactElement {
  const widths = ["36%", "16%", "12%", "10%", "13%", "13%"];
  return h(
    View,
    null,
    row("h", ["Goods", "HS code", "Made in", "Pieces", "Each", "Line total"], widths, true),
    ...invoice.lines.map((l, i) =>
      row(
        `l${i}`,
        [l.description, l.hsCode ?? NOT_ON_FILE, l.originCountry, String(l.pieces), money(l.unitValueMinor, invoice.currency), money(l.lineValueMinor, invoice.currency)],
        widths,
      ),
    ),
    row("t", ["Total", "", "", String(invoice.totalPieces), "", money(invoice.totalValueMinor, invoice.currency)], widths, true),
  );
}

const detail = (label: string, value: string, key: string): ReactElement =>
  row(key, [label, value], ["34%", "66%"]);

function detailsBlock(invoice: InvoiceModel): ReactElement {
  return h(
    View,
    { style: { marginTop: 8 } },
    detail("Invoice date", invoice.issuedOn, "d1"),
    detail("Order reference", invoice.orderRef, "d2"),
    detail("Consignor (goods made by)", invoice.consignorLine, "d3"),
    detail("Consignee (brand)", invoice.brandName, "d4"),
    detail("Country of origin", invoice.originCountry, "d5"),
    detail("Country of destination", `${invoice.destinationName} (${invoice.destinationCountry})`, "d6"),
    detail("Preference scheme claimed", invoice.preferenceScheme ?? "None on file", "d7"),
    detail("Terms of delivery", invoice.incoterms === "" ? "Not stated" : invoice.incoterms, "d8"),
    detail("Pieces by size", invoice.sizesLine, "d9"),
  );
}

/** The commercial invoice as an A4 PDF, built in memory. Every string goes through the tech pack's own check. */
export async function commercialInvoicePdf(invoice: InvoiceModel): Promise<Uint8Array<ArrayBuffer>> {
  registerPdfFont();
  if (!hyphenationOff) {
    Font.registerHyphenationCallback((word) => [word]);
    hyphenationOff = true;
  }
  const title = `Commercial invoice ${invoice.orderRef}`;
  const page = h(
    Page,
    { size: "A4", style: { fontFamily: PDF_FONT_FAMILY, padding: 36, paddingBottom: 48, color: INK } },
    text("Commercial invoice", { fontSize: 18 }),
    text(`Knitwright · order ${invoice.orderRef}`, { color: MUTED, marginTop: 2 }),
    text(invoice.dateNote, { color: ATTENTION, marginTop: 6 }),
    h(View, { key: "details" }, heading("Details"), detailsBlock(invoice)),
    h(View, { key: "goods" }, heading("Goods"), linesTable(invoice)),
    h(
      View,
      { key: "missing" },
      heading("What this invoice cannot state"),
      ...(invoice.missing.length === 0
        ? [text("Nothing: every field above came from a row.", { color: MUTED })]
        : invoice.missing.map((m, i) => text(`• ${m}`, { color: ATTENTION, marginTop: 2 }, `m${i}`))),
    ),
    h(View, { key: "note" }, heading("Origin"), text(DCTS_NOTE, { color: MUTED })),
    h(Text, {
      fixed: true,
      style: { position: "absolute", bottom: 24, left: 36, right: 36, fontFamily: PDF_FONT_FAMILY, fontSize: 8, color: MUTED },
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${drawable(title)} · page ${pageNumber} of ${totalPages}`,
    }),
  );
  const document = h(
    Document,
    { title: drawable(title), creator: "Knitwright", producer: "Knitwright", creationDate: CREATED, modificationDate: CREATED },
    page,
  );
  return new Uint8Array(await renderToBuffer(document));
}
