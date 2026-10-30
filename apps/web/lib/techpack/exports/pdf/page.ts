import { Page, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY } from "@/lib/flat/pdf-font";
import { TO_BE_CONFIRMED, type Cell } from "../../cell";
import type { TechPack } from "../../types";
import { drawingsFor } from "../flat-views";
import type { ExportIllustrations } from "../illustrations";
import type { PlannedPage } from "../pages";
import type { ExportTable } from "../table-types";
import { illustrationsElement } from "./illustrations";
import { heading, paragraph, type Safe } from "./parts";
import { blockElement, drawingRow, tableGroup, type Context } from "./sections";
import { COLOURS, MARGIN, SIZES } from "./styles";

/**
 * One page of the sixteen (decision 0078). Every page carries the same header block — brand,
 * style name, style number, season, base size and version, as F-S6 asks — and the footer the
 * document already had, which ends in "Page x of y". The header and the footer are fixed, so a
 * page whose tables run past the paper repeats them both.
 */

/** Room at the top for the header block, and at the bottom for the footer. */
const HEADER_SPACE = 74;

const headerLine = (pack: TechPack): readonly Readonly<{ label: string; cell: Cell | null; text: string | null }>[] => [
  { label: "Brand", cell: pack.cover.brand, text: null },
  { label: "Style", cell: pack.cover.designName, text: null },
  { label: "Style number", cell: pack.cover.styleNumber, text: null },
  { label: "Season", cell: pack.cover.season, text: null },
  { label: "Base size", cell: pack.cover.baseSize, text: null },
  { label: "Version", cell: null, text: String(pack.cover.version) },
];

const words = (entry: Readonly<{ cell: Cell | null; text: string | null }>): string =>
  entry.text ?? (entry.cell?.status === "set" ? entry.cell.value : TO_BE_CONFIRMED);

const field = (entry: Readonly<{ label: string; cell: Cell | null; text: string | null }>, safe: Safe): ReactElement =>
  h(
    View,
    { key: entry.label, style: { marginRight: 14 } },
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.small, color: COLOURS.muted } }, safe(entry.label)),
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.cell, color: COLOURS.ink } }, safe(words(entry))),
  );

/** The page number as the footer and the header both say it: "Page 4 of 16" for one of the sixteen. */
export const pageMark = (page: PlannedPage): string => (page.number === null ? page.title : `Page ${page.number} of 16 · ${page.title}`);

/** The header block, repeated at the top of every sheet of paper this page runs onto. */
function header(pack: TechPack, page: PlannedPage, safe: Safe): ReactElement {
  return h(
    View,
    {
      fixed: true,
      style: {
        position: "absolute",
        top: 18,
        left: MARGIN.side,
        right: MARGIN.side,
        borderBottomWidth: 0.5,
        borderBottomColor: COLOURS.line,
        paddingBottom: 5,
      },
    },
    h(View, { style: { flexDirection: "row", flexWrap: "wrap" } }, ...headerLine(pack).map((entry) => field(entry, safe))),
    h(
      Text,
      { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.small, color: COLOURS.muted, marginTop: 4 } },
      safe(pageMark(page)),
    ),
  );
}

export interface PageOptions {
  /** The photoreal pictures, which go on the reference-images page. Null when there are none. */
  readonly illustrations: ExportIllustrations | null;
  /** The tables of the sources page: the key of the marks, the classes, and the notes. */
  readonly appendix: readonly ExportTable[];
  /** A sentence about the file itself, said on the first page, or null. */
  readonly notice: string | null;
}

/** A sentence about the file itself, in the colour the document uses for things to look at. */
const noticeLine = (notice: string, safe: Safe): ReactElement =>
  h(Text, { key: "notice", style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.warn, marginBottom: 4 } }, safe(notice));

/** What the reference-images page draws: the pictures when there are any, else nothing. */
const illustrations = (page: PlannedPage, options: PageOptions, safe: Safe): readonly ReactElement[] =>
  page.drawing === "illustrations" && options.illustrations !== null ? [illustrationsElement(options.illustrations, safe)] : [];

/** One page of the document: the header, the title and lead, what cannot be filled, the drawings, then the tables. */
export function pageElement(page: PlannedPage, context: Context, options: PageOptions, footer: ReactElement): ReactElement {
  const { safe, pack } = context;
  const views = drawingsFor(page.drawing, pack);
  return h(
    Page,
    {
      key: page.id,
      size: "A4",
      style: {
        fontFamily: PDF_FONT_FAMILY,
        fontSize: SIZES.body,
        color: COLOURS.ink,
        paddingTop: HEADER_SPACE,
        paddingBottom: MARGIN.bottom,
        paddingHorizontal: MARGIN.side,
      },
    },
    header(pack, page, safe),
    h(View, { key: "lead", wrap: false }, heading(2, page.title, safe), paragraph(page.lead, safe, "lead")),
    ...(page.number === 1 && options.notice !== null ? [noticeLine(options.notice, safe)] : []),
    ...(page.gap === null ? [] : [paragraph(`${page.gap.note} (${page.gap.ruleId})`, safe, "gap")]),
    ...(views.length === 0 ? [] : [drawingRow(`${page.id}-drawings`, views, context)]),
    ...illustrations(page, options, safe),
    ...(page.id === "sources-and-notes" ? options.appendix.map((table, index) => tableGroup(table, index, safe, context.marks)) : []),
    ...page.blocks.map((block) => blockElement(block, context)),
    footer,
  );
}
