import { Document, Font, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { drawable } from "@/lib/techpack/exports/pdf-text";
import { CUT_LABELS, type Manifest } from "./manifest";

const INK = "#0f1012";
const MUTED = "#62656d";
const LINE = "#d9d9dd";

/** Fixed, so the same team list gives the same file. */
const CREATED = new Date(Date.UTC(2000, 0, 1));

let hyphenationOff = false;

const cell = (text: string, width: string, bold = false): ReactElement =>
  h(Text, { style: { width, fontFamily: PDF_FONT_FAMILY, fontSize: bold ? 9.5 : 9, color: INK, paddingVertical: 2 } }, drawable(text));

const row = (key: string, cells: readonly string[], widths: readonly string[], bold = false): ReactElement =>
  h(View, { key, wrap: false, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE } }, ...cells.map((c, i) => cell(c, widths[i] ?? "10%", bold)));

const title = (text: string): ReactElement =>
  h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: 12, marginTop: 16, marginBottom: 4, color: INK } }, text);

function totalsTable(m: Manifest): ReactElement {
  const width = `${Math.floor(100 / (m.cuts.length + 2))}%`;
  const widths = Array.from({ length: m.cuts.length + 2 }, () => width);
  return h(
    View,
    { key: "totals" },
    row("head", ["Size", ...m.cuts.map((c) => CUT_LABELS[c]), "Total"], widths, true),
    ...m.sizes.map((size, i) => row(`s-${size}`, [size, ...(m.cells[i] ?? []).map(String), String(m.sizeTotals[i] ?? 0)], widths)),
    row("sum", ["Total", ...m.cutTotals.map(String), String(m.totalShirts)], widths, true),
  );
}

function playersTable(m: Manifest): ReactElement {
  const widths = ["40%", "12%", "16%", "20%", "12%"];
  return h(
    View,
    { key: "players" },
    row("head", ["Name", "Number", "Size", "Cut", "Shirts"], widths, true),
    ...m.players.map((p, i) => row(`p-${i}`, [p.name, p.number, p.sizeLabel, CUT_LABELS[p.cut], String(p.quantity)], widths)),
  );
}

/** The manifest as a PDF, built in memory. Names go through the same character check as the tech pack. */
export async function manifestPdf(m: Manifest, designName: string): Promise<Uint8Array<ArrayBuffer>> {
  registerPdfFont();
  if (!hyphenationOff) {
    Font.registerHyphenationCallback((word) => [word]);
    hyphenationOff = true;
  }
  const page = h(
    Page,
    { size: "A4", style: { fontFamily: PDF_FONT_FAMILY, padding: 36, color: INK } },
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: 18 } }, drawable(`Team order: ${m.orderName}`)),
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: 9, color: MUTED, marginTop: 2 } }, drawable(`${designName} · ${m.totalShirts} shirts for ${m.players.length} rows`)),
    title("Shirts by size and cut"),
    totalsTable(m),
    title("Players"),
    playersTable(m),
  );
  const document = h(Document, { title: drawable(`Team order ${m.orderName}`), creator: "Knitwright", producer: "Knitwright", creationDate: CREATED, modificationDate: CREATED }, page);
  return new Uint8Array(await renderToBuffer(document));
}
