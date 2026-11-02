import { Page, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { pageTitleKey, type TranslationKey } from "@/lib/translate/keys";
import type { Cell } from "../../cell";
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
 *
 * A page set in another language reads the other way: the header fields, the tables and the text all
 * run right to left, the words of the furniture come from the typeset, and the page carries the
 * notice that nobody has read the translation (decision 0103). Everything a person typed stays
 * exactly as they typed it, in the language they typed it in.
 */

/** Room at the top for the header block, and at the bottom for the footer. */
const HEADER_SPACE = 74;

/** Room for the line that says nobody has read the translation, when the page carries one. */
const NOTICE_SPACE = 12;

type HeaderField = Readonly<{ key: TranslationKey; cell: Cell | null; text: string | null }>;

const headerLine = (pack: TechPack): readonly HeaderField[] => [
  { key: "field.brand", cell: pack.cover.brand, text: null },
  { key: "field.style", cell: pack.cover.designName, text: null },
  { key: "field.style-number", cell: pack.cover.styleNumber, text: null },
  { key: "field.season", cell: pack.cover.season, text: null },
  { key: "field.base-size", cell: pack.cover.baseSize, text: null },
  { key: "field.version", cell: null, text: String(pack.cover.version) },
];

const words = (entry: HeaderField, safe: Safe): string =>
  entry.text ?? (entry.cell?.status === "set" ? entry.cell.value : safe.words("value.to-be-confirmed"));

const field = (entry: HeaderField, safe: Safe): ReactElement =>
  h(
    View,
    { key: entry.key, style: safe.direction === "rtl" ? { marginLeft: 14 } : { marginRight: 14 } },
    h(Text, { style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.small, color: COLOURS.muted } }, safe.words(entry.key)),
    h(Text, { style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.cell, color: COLOURS.ink } }, safe(words(entry, safe))),
  );

/**
 * What the header block says this page is. It carries the title and not the page number: the
 * footer counts the pages, and a number in the header would be a number a factory cannot check
 * against the document.
 */
export const pageMark = (page: PlannedPage, safe: Safe): string => {
  const key = pageTitleKey(page.id);
  return key === null ? safe(page.title) : safe.words(key);
};

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
    h(View, { style: { flexDirection: safe.row, flexWrap: "wrap" } }, ...headerLine(pack).map((entry) => field(entry, safe))),
    h(
      Text,
      { style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.small, color: COLOURS.muted, marginTop: 4 } },
      pageMark(page, safe),
    ),
  );
}

/**
 * The line that says nobody has read this translation, fixed under the header so it is on every
 * sheet of paper the page runs onto. A document whose words nobody has checked can never be read
 * without it.
 */
const unreviewedLine = (safe: Safe): readonly ReactElement[] =>
  safe.unreviewedNotice === null
    ? []
    : [
        h(
          Text,
          {
            key: "unreviewed",
            fixed: true,
            style: {
              position: "absolute",
              top: HEADER_SPACE - NOTICE_SPACE,
              left: MARGIN.side,
              right: MARGIN.side,
              fontFamily: safe.family,
              direction: safe.direction,
              fontSize: SIZES.small,
              color: COLOURS.warn,
            },
          },
          safe.unreviewedNotice,
        ),
      ];

export interface PageOptions {
  /** The photoreal pictures, which go on the reference-images page. Null when there are none. */
  readonly illustrations: ExportIllustrations | null;
  /** The tables of the sources page: the key of the marks, the classes, and the notes. */
  readonly appendix: readonly ExportTable[];
  /** A sentence about the file itself, said on the first page, or null. */
  readonly notice: string | null;
}

/** A sentence about the file itself, in the colour the document uses for things to look at. */
const noticeLine = (notice: string, safe: Safe, key: string): ReactElement =>
  h(
    Text,
    { key, style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.body, color: COLOURS.warn, marginBottom: 4 } },
    safe(notice),
  );

/** What the reference-images page draws: the pictures when there are any, else nothing. */
const illustrations = (page: PlannedPage, options: PageOptions, safe: Safe): readonly ReactElement[] =>
  page.drawing === "illustrations" && options.illustrations !== null ? [illustrationsElement(options.illustrations, safe)] : [];

/** Said on the first page of a translated document: which words are in the language, and which are not. */
const scopeLine = (page: PlannedPage, safe: Safe): readonly ReactElement[] =>
  page.number === 1 && safe.scopeNotice !== null
    ? [
        h(
          Text,
          { key: "scope", style: { fontFamily: safe.family, direction: safe.direction, fontSize: SIZES.body, color: COLOURS.muted, marginBottom: 4 } },
          safe.scopeNotice,
        ),
      ]
    : [];

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
        fontFamily: safe.family,
        direction: safe.direction,
        fontSize: SIZES.body,
        color: COLOURS.ink,
        paddingTop: safe.unreviewedNotice === null ? HEADER_SPACE : HEADER_SPACE + NOTICE_SPACE,
        paddingBottom: MARGIN.bottom,
        paddingHorizontal: MARGIN.side,
      },
    },
    header(pack, page, safe),
    ...unreviewedLine(safe),
    // The title is already made safe by `pageMark`, and making text safe twice changes nothing.
    h(View, { key: "lead", wrap: false }, heading(2, pageMark(page, safe), safe), paragraph(page.lead, safe, "lead")),
    ...scopeLine(page, safe),
    ...(page.number === 1 && options.notice !== null ? [noticeLine(options.notice, safe, "notice")] : []),
    ...(page.gap === null ? [] : [paragraph(page.gap.note, safe, "gap")]),
    ...(views.length === 0 ? [] : [drawingRow(`${page.id}-drawings`, views, context)]),
    ...illustrations(page, options, safe),
    ...(page.id === "sources-and-notes" ? options.appendix.map((table, index) => tableGroup(table, index, safe, context.marks)) : []),
    ...page.blocks.map((block) => blockElement(block, context)),
    footer,
  );
}
