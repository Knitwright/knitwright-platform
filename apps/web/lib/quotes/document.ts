import { Document, Page, Text, View, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { ENGLISH_TYPESET } from "@/lib/techpack/exports/pdf/typeset";
import { heading, paragraph } from "@/lib/techpack/exports/pdf/parts";
import { COLOURS, MARGIN, SIZES } from "@/lib/techpack/exports/pdf/styles";
import type { Quote } from "./quote";
import { NOT_KNOWN, NO_PAYMENT_HERE, QUOTE_LEAD, QUOTE_TITLE } from "./settings";

/**
 * The quote as a PDF (spec F-T5). It is built on the PDF machinery the tech pack already has —
 * the registered Geist face (`lib/flat/pdf-font`), the character guard (`pdf-text`), the heading
 * and paragraph parts, and the one set of sizes and colours (`exports/pdf/styles`) — so there is
 * one PDF path in this codebase and not two, and a quote looks like the rest of Knitwright's paper.
 *
 * IT STATES NO FIGURE OF ITS OWN. Every price, date and rate on the page is read off the `Quote`
 * value, which `buildQuote` has already checked against `priceFor`. Where something is not known
 * the page says so in words, in the attention colours, and never leaves a blank: there is no cell
 * on this document that can be empty.
 */

/** A row of the table: a label on the left, a value on the right. */
const row = (key: string, label: string, value: string, tone: string = COLOURS.ink): ReactElement =>
  h(
    View,
    { key, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOURS.line, paddingVertical: 3 } },
    h(Text, { style: { width: "34%", fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.cell, color: COLOURS.muted } }, ENGLISH_TYPESET(label)),
    h(Text, { style: { width: "66%", fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.cell, color: tone } }, ENGLISH_TYPESET(value)),
  );

/** A value nobody has given is in the attention colours, never blank and never a dash. */
const unknownRow = (key: string, label: string, value: string): ReactElement => row(key, label, value, COLOURS.warn);

const COLUMNS = ["48%", "12%", "20%", "20%"] as const;

const cell = (key: string, text: string, width: string, tone: string, size: number = SIZES.cell): ReactElement =>
  h(Text, { key, style: { width, fontFamily: PDF_FONT_FAMILY, fontSize: size, color: tone } }, ENGLISH_TYPESET(text));

const lineRow = (line: Quote["lines"][number], at: number): ReactElement =>
  h(
    View,
    { key: `line-${at}`, wrap: false, style: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOURS.line, paddingVertical: 3 } },
    cell("l", `${line.label} · ${line.articleCode}`, COLUMNS[0], COLOURS.ink),
    cell("q", String(line.qty), COLUMNS[1], COLOURS.ink),
    cell("u", line.priced ? `${line.unit} each · tier ${line.tier}` : line.unit, COLUMNS[2], line.priced ? COLOURS.ink : COLOURS.warn),
    cell("t", line.line, COLUMNS[3], line.priced ? COLOURS.ink : COLOURS.warn),
  );

const linesTable = (quote: Quote): ReactElement =>
  h(
    View,
    { key: "lines", style: { marginBottom: 6 } },
    h(
      View,
      { key: "head", fixed: true, style: { flexDirection: "row", backgroundColor: COLOURS.head, paddingVertical: 3 } },
      cell("l", "What", COLUMNS[0], COLOURS.ink),
      cell("q", "Pieces", COLUMNS[1], COLOURS.ink),
      cell("u", "Each", COLUMNS[2], COLOURS.ink),
      cell("t", "Line", COLUMNS[3], COLOURS.ink),
    ),
    ...quote.lines.map(lineRow),
    ...quote.lines.flatMap((line, at) => (line.reason === null ? [] : [paragraph(line.reason, ENGLISH_TYPESET, `why-${at}`)])),
  );

/** A part the factory has no price for. It is on the page, never left off it. */
const unpricedBlock = (quote: Quote): readonly ReactElement[] =>
  quote.unpriced.length === 0
    ? []
    : [
        heading(3, "Not priced yet", ENGLISH_TYPESET),
        ...quote.unpriced.map((part, at) => unknownRow(`un-${at}`, part.label, part.reason)),
      ];

const inclusionsBlock = (quote: Quote): readonly ReactElement[] => [
  heading(3, "What is included", ENGLISH_TYPESET),
  ...quote.inclusions.map((one, at) => row(`inc-${at}`, `${one.label} · ${one.included ? "included" : "not on this kit"}`, `${one.note} (${one.ruleId})`)),
];

const termsBlock = (quote: Quote): readonly ReactElement[] => [
  heading(3, "Delivery, tax and validity", ENGLISH_TYPESET),
  quote.delivery.status === "set"
    ? row("del", "Delivery", quote.delivery.text)
    : unknownRow("del", "Delivery", quote.delivery.text),
  ...(quote.delivery.note === "" ? [] : [row("delnote", "About that date", quote.delivery.note)]),
  quote.vat.rate === NOT_KNOWN ? unknownRow("vat", "VAT treatment", quote.vat.text) : row("vat", "VAT treatment", quote.vat.text),
  row("vatlabel", "About that rate", quote.vat.label),
  row("valid", "Valid until", `${quote.validUntil} (${quote.validityDays} days from ${quote.issuedOn})`),
  row("back", "Carry on with this kit", quote.linkBack),
  quote.factoryLabel === null
    ? unknownRow("factory", "Made by", "No factory is on file yet, so these prices come from no factory's own terms.")
    : row("factory", "Made by", quote.factoryLabel),
];

const totalBlock = (quote: Quote): readonly ReactElement[] => [
  h(
    View,
    { key: "total", style: { flexDirection: "row", marginTop: 8, paddingTop: 5, borderTopWidth: 1, borderTopColor: COLOURS.ink } },
    cell("l", `Total, ${quote.tierQty} pieces in the basket`, "68%", COLOURS.ink, SIZES.table),
    cell("v", quote.total, "32%", quote.totalMinor === null ? COLOURS.warn : COLOURS.ink, SIZES.table),
  ),
  ...(quote.totalNote === null ? [] : [paragraph(quote.totalNote, ENGLISH_TYPESET, "total-note")]),
  paragraph(NO_PAYMENT_HERE, ENGLISH_TYPESET, "money-note"),
];

const header = (quote: Quote): ReactElement =>
  h(
    View,
    { key: "header", style: { marginBottom: 8 } },
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.title, color: COLOURS.ink } }, ENGLISH_TYPESET(`${QUOTE_TITLE} ${quote.number}`)),
    h(
      Text,
      { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.muted, marginTop: 2 } },
      ENGLISH_TYPESET(`${quote.clubName} · ${quote.sportLabel} · ${quote.issuedOn} · prepared by ${quote.brandName}`),
    ),
  );

const footer = (quote: Quote): ReactElement =>
  h(Text, {
    fixed: true,
    style: {
      position: "absolute",
      bottom: 24,
      left: MARGIN.side,
      right: MARGIN.side,
      fontFamily: PDF_FONT_FAMILY,
      fontSize: SIZES.footer,
      color: COLOURS.muted,
      borderTopWidth: 0.5,
      borderTopColor: COLOURS.line,
      paddingTop: 4,
    },
    render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
      `${quote.number}  ·  valid until ${quote.validUntil}  ·  Page ${pageNumber} of ${totalPages}`,
  });

/** The one page of a quote, as a React element for the PDF library. */
export function quoteDocument(quote: Quote): ReactElement<DocumentProps> {
  registerPdfFont();
  const page = h(
    Page,
    {
      key: "quote",
      size: "A4",
      style: {
        fontFamily: PDF_FONT_FAMILY,
        fontSize: SIZES.body,
        color: COLOURS.ink,
        paddingTop: MARGIN.top,
        paddingBottom: MARGIN.bottom,
        paddingHorizontal: MARGIN.side,
      },
    },
    header(quote),
    paragraph(QUOTE_LEAD, ENGLISH_TYPESET, "lead"),
    heading(3, "Your kit", ENGLISH_TYPESET),
    linesTable(quote),
    ...totalBlock(quote),
    ...unpricedBlock(quote),
    ...inclusionsBlock(quote),
    ...termsBlock(quote),
    footer(quote),
  );
  return h(Document, { title: `${QUOTE_TITLE} ${quote.number}`, creator: "Knitwright", producer: "Knitwright" }, page);
}

/** The PDF of a quote, in memory. Nothing is written to disk and nothing is stored. */
export async function buildQuotePdf(quote: Quote): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await renderToBuffer(quoteDocument(quote)));
}
