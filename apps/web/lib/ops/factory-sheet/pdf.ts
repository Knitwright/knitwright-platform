import { Document, Font, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { drawable } from "@/lib/techpack/exports/pdf-text";
import type { SheetModel } from "./model";

const INK = "#0f1012";
const MUTED = "#62656d";
const LINE = "#d9d9dd";
const ATTENTION = "#9a3412";

/** Fixed, so the same sheet gives the same file. */
const CREATED = new Date(Date.UTC(2000, 0, 1));

let hyphenationOff = false;

const text = (value: string, style: Record<string, unknown> = {}, key?: string): ReactElement =>
  h(Text, { key, style: { fontFamily: PDF_FONT_FAMILY, fontSize: 9, color: INK, ...style } }, drawable(value));

const cell = (value: string, width: string, bold = false): ReactElement => text(value, { width, fontSize: bold ? 9.5 : 9, paddingVertical: 2, paddingRight: 4 });

const row = (key: string, cells: readonly string[], widths: readonly string[], bold = false): ReactElement =>
  h(View, { key, wrap: false, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE } }, ...cells.map((c, i) => cell(c, widths[i] ?? "10%", bold)));

const heading = (value: string): ReactElement => text(value, { fontSize: 12, marginTop: 16, marginBottom: 4 });

const evenWidths = (n: number, first = 28): string[] => [`${first}%`, ...Array.from({ length: n }, () => `${Math.floor((100 - first) / Math.max(n, 1))}%`)];

function section(key: string, title: string, ...children: ReactElement[]): ReactElement {
  return h(View, { key }, heading(title), ...children);
}

function ordersTable(m: SheetModel): ReactElement {
  const widths = ["22%", "22%", "30%", "10%", "16%"];
  return h(View, null, row("h", ["Order", "Brand", "Release", "Pieces", "Promised"], widths, true), ...m.orders.map((o) => row(o.ref, [o.ref, o.brand, o.release, String(o.pieces), o.promised], widths)));
}

function breakdownTable(m: SheetModel): ReactElement {
  const widths = evenWidths(m.sizes.length + 1);
  return h(
    View,
    null,
    row("h", ["Order", ...m.sizes, "Total"], widths, true),
    ...m.breakdown.map((b) => row(b.ref, [b.ref, ...b.counts.map(String), String(b.total)], widths)),
    row("sum", ["All orders", ...m.totals.counts.map(String), String(m.totals.total)], widths, true),
  );
}

function bomTable(m: SheetModel): ReactElement {
  const widths = ["30%", "30%", "40%"];
  return h(View, null, row("h", ["Item", "Quantity", "Where this comes from"], widths, true), ...m.bom.map((b) => row(b.item, [b.item, b.quantity, b.source], widths)));
}

function namesBlock(m: SheetModel): ReactElement[] {
  const widths = ["46%", "14%", "16%", "24%"];
  return m.names.map((n) =>
    h(
      View,
      { key: n.ref, style: { marginTop: 8 } },
      text(`Order ${n.ref}`, { fontSize: 10, marginBottom: 2 }),
      n.notice ? text(n.notice, { color: MUTED }) : h(View, null, row("h", ["Name", "Number", "Size", "Cut"], widths, true), ...n.rows.map((r, i) => row(`${i}`, [r.name || "No name", r.number, r.sizeLabel, r.cut], widths))),
    ),
  );
}

/** The factory sheet as an A4 PDF, built in memory. Every string goes through the same character check as the tech pack. */
export async function factorySheetPdf(m: SheetModel): Promise<Uint8Array<ArrayBuffer>> {
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
    text(m.cutoffLine, { color: MUTED, marginTop: 2 }),
    text(`Due date: ${m.dueDate}`, { fontSize: 11, marginTop: 6 }),
    ...(m.dueNote ? [text(m.dueNote, { color: ATTENTION })] : []),
    ...m.warnings.map((w, i) => text(w, { color: ATTENTION, marginTop: 2 }, `w${i}`)),
    section("orders", "Orders", ordersTable(m)),
    section("sizes", "Pieces by size", breakdownTable(m)),
    section("bom", "Fabric and trims", bomTable(m)),
    section("names", "Names and numbers", ...namesBlock(m)),
    section("packing", "Packing", text(m.packingLabel, { color: MUTED, marginBottom: 2 }), ...m.packing.map((p, i) => text(`${i + 1}. ${p}`, { marginTop: 2 }, `p${i}`))),
    h(Text, { fixed: true, style: { position: "absolute", bottom: 24, left: 36, right: 36, fontFamily: PDF_FONT_FAMILY, fontSize: 8, color: MUTED }, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${drawable(m.title)} · page ${pageNumber} of ${totalPages}` }),
  );
  const document = h(Document, { title: drawable(m.title), creator: "Knitwright", producer: "Knitwright", creationDate: CREATED, modificationDate: CREATED }, page);
  return new Uint8Array(await renderToBuffer(document));
}
