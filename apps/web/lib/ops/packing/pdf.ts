import { Document, Font, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { drawable } from "@/lib/techpack/exports/pdf-text";
import type { PackingModel } from "./model";

const INK = "#0f1012";
const MUTED = "#62656d";
const LINE = "#d9d9dd";
const ATTENTION = "#9a3412";

/** Fixed, so the same list gives the same file. */
const CREATED = new Date(Date.UTC(2000, 0, 1));

let hyphenationOff = false;

const text = (value: string, style: Record<string, unknown> = {}, key?: string): ReactElement =>
  h(Text, { key, style: { fontFamily: PDF_FONT_FAMILY, fontSize: 9, color: INK, ...style } }, drawable(value));

const row = (key: string, cells: readonly string[], widths: readonly string[], bold = false): ReactElement =>
  h(View, { key, wrap: false, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE } }, ...cells.map((c, i) => text(c, { width: widths[i] ?? "10%", fontSize: bold ? 9.5 : 9, paddingVertical: 2, paddingRight: 4 }, `${key}${i}`)));

const heading = (value: string): ReactElement => text(value, { fontSize: 12, marginTop: 16, marginBottom: 4 });

function cartonsTable(m: PackingModel): ReactElement {
  const widths = ["14%", "26%", "40%", "20%"];
  return h(View, null, row("h", ["Carton", "Weight", "Size", "Bags"], widths, true), ...m.cartons.map((c) => row(`c${c.no}`, [c.no, c.weight, c.size, c.bags], widths)));
}

/** One label per bag, as the text to print or write on it. */
function labels(m: PackingModel): ReactElement[] {
  return m.bags.map((b) =>
    h(
      View,
      { key: `b${b.no}`, wrap: false, style: { marginTop: 6, padding: 6, borderWidth: 0.5, borderColor: LINE } },
      ...b.label.map((l, i) => text(l, { fontSize: i === 0 ? 11 : 9 }, `l${b.no}-${i}`)),
      text(b.carton, { color: MUTED, marginTop: 2 }, `k${b.no}`),
    ),
  );
}

/** The packing list of one order as an A4 PDF, built in memory. Every string goes through the same character check as the tech pack. */
export async function packingListPdf(m: PackingModel): Promise<Uint8Array<ArrayBuffer>> {
  registerPdfFont();
  if (!hyphenationOff) {
    Font.registerHyphenationCallback((word) => [word]);
    hyphenationOff = true;
  }
  const page = h(
    Page,
    { size: "A4", style: { fontFamily: PDF_FONT_FAMILY, padding: 36, paddingBottom: 48, color: INK } },
    text(m.title, { fontSize: 18 }),
    text(m.subtitle, { color: MUTED, marginTop: 2 }),
    text(m.summary, { marginTop: 6, fontSize: 11 }),
    ...m.warnings.map((w, i) => text(w, { color: ATTENTION, marginTop: 2 }, `w${i}`)),
    h(View, { key: "cartons" }, heading("Cartons"), m.cartons.length === 0 ? text("No carton has been set up.", { color: MUTED }) : cartonsTable(m)),
    h(View, { key: "labels" }, heading("Bag labels"), ...labels(m)),
    h(Text, { fixed: true, style: { position: "absolute", bottom: 24, left: 36, right: 36, fontFamily: PDF_FONT_FAMILY, fontSize: 8, color: MUTED }, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${drawable(m.title)} · page ${pageNumber} of ${totalPages}` }),
  );
  const document = h(Document, { title: drawable(m.title), creator: "Knitwright", producer: "Knitwright", creationDate: CREATED, modificationDate: CREATED }, page);
  return new Uint8Array(await renderToBuffer(document));
}
