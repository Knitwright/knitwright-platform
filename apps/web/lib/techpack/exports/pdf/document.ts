import { Document, Font, Text, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { ImageMap } from "@/lib/flat/images";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { TO_BE_CONFIRMED } from "../../cell";
import type { TechPack } from "../../types";
import { assertEverySetCellHasSource } from "../guard";
import { drawable, hasUndrawable } from "../pdf-text";
import { leaves } from "../../walk";
import type { ExportIllustrations } from "../illustrations";
import { pagePlan } from "../pages";
import { exportSections } from "../tables";
import { appendixTables } from "./appendix";
import { sourceMarks } from "./marks";
import { pageElement } from "./page";
import { COLOURS, MARGIN, SIZES } from "./styles";

/** Said on the first page when a character the font lacks was shown as a question mark. It holds no digit. */
export const CHARACTERS_REPLACED = "Some characters could not be drawn in this file, so each is shown as a question mark.";

export interface PdfOptions {
  /** True when a picture was left out for size, so the document says so in words. */
  readonly pictureLeftOut?: boolean;
  /** AI pictures of the design, added to the reference-images page and labelled as illustrations. */
  readonly illustrations?: ExportIllustrations | null;
}

/**
 * Whether anything in the document holds a character the font cannot draw, read from the document
 * itself rather than from the drawing of it: the first page says so, and the first page is built
 * before the rest. Everything a person typed is in the document, and the words the platform adds
 * are all plain, so this finds every case the renderer would replace.
 */
const noticeFor = (pack: TechPack): string | null =>
  leaves(pack).some(({ leaf }) => hasUndrawable(String(leaf))) ? CHARACTERS_REPLACED : null;

const designLabel = (pack: TechPack, safe: (text: string) => string): string => {
  const { styleNumber, designName } = pack.cover;
  const parts = [designName, styleNumber].map((cell) => (cell.status === "set" ? safe(cell.value) : ""));
  return parts.filter((part) => part !== "").join(" · ") || TO_BE_CONFIRMED;
};

/** The footer of every page: the style, the version, the date this copy was printed, and "Page x of y". */
const footer = (pack: TechPack, safe: (text: string) => string): ReactElement => {
  const label = `${designLabel(pack, safe)}  ·  Version ${pack.cover.version}  ·  ${pack.printedOn}`;
  return h(Text, {
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
      `${label}  ·  Page ${pageNumber} of ${totalPages}`,
  });
};

let hyphenationOff = false;

/** Words are never split with a hyphen at the end of a line, so the text reads back as it was written. */
function switchHyphenationOff(): void {
  if (hyphenationOff) return;
  Font.registerHyphenationCallback((word) => [word]);
  hyphenationOff = true;
}

/**
 * The pages of the document: the sixteen of F-S6 in the specification's order, then the sources
 * page and the sign-off page.
 */
function buildPages(pack: TechPack, images: ImageMap, options: PdfOptions, notice: string | null): readonly ReactElement[] {
  const safe = drawable;
  const exported = exportSections(pack);
  const marks = sourceMarks(exported);
  const context = { pack, images, safe, pictureLeftOut: options.pictureLeftOut === true, marks };
  const pageOptions = {
    illustrations: options.illustrations ?? null,
    appendix: appendixTables(exported, marks),
    notice,
  };
  const sheet = footer(pack, safe);
  return pagePlan(exported).map((page) => pageElement(page, context, pageOptions, sheet));
}

/** The document as a React element for the PDF library (decision 0078). */
function techPackDocument(pack: TechPack, images: ImageMap, options: PdfOptions = {}): ReactElement<DocumentProps> {
  registerPdfFont();
  switchHyphenationOff();
  const pages = buildPages(pack, images, options, noticeFor(pack));
  const title = designLabel(pack, drawable);
  return h(Document, { title, creator: "Knitwright", producer: "Knitwright" }, ...pages);
}

/** The PDF of a tech pack, in memory. Nothing is written to disk. */
export async function buildPdf(pack: TechPack, images: ImageMap, options: PdfOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  assertEverySetCellHasSource(pack);
  return new Uint8Array(await renderToBuffer(techPackDocument(pack, images, options)));
}
