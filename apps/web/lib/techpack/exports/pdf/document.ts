import { Document, Font, Text, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { ImageMap } from "@/lib/flat/images";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { TO_BE_CONFIRMED } from "../../cell";
import type { TechPack } from "../../types";
import { assertEverySetCellHasSource } from "../guard";
import { drawable, hasUndrawable } from "../pdf-text";
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

/** Text made drawable, and a record of whether any character had to be replaced. */
function safety(): { safe: (text: string) => string; replaced: () => boolean } {
  let replaced = false;
  return {
    safe: (text) => {
      if (hasUndrawable(text)) replaced = true;
      return drawable(text);
    },
    replaced: () => replaced,
  };
}

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

interface Built {
  readonly pages: readonly ReactElement[];
  /** True when a character the font lacks was shown as a question mark somewhere in the document. */
  readonly replaced: boolean;
}

/**
 * The pages of the document: the sixteen of F-S6 in the specification's order, then the sources
 * page and the sign-off page. `notice` is said on the first page, and is known only once every
 * page has been built, so the pages are built twice: once to learn it, once to say it.
 */
function buildPages(pack: TechPack, images: ImageMap, options: PdfOptions, notice: string | null): Built {
  const { safe, replaced } = safety();
  const exported = exportSections(pack);
  const marks = sourceMarks(exported);
  const context = { pack, images, safe, pictureLeftOut: options.pictureLeftOut === true, marks };
  const pageOptions = {
    illustrations: options.illustrations ?? null,
    appendix: appendixTables(exported, marks),
    notice,
  };
  const sheet = footer(pack, safe);
  const pages = pagePlan(exported).map((page) => pageElement(page, context, pageOptions, sheet));
  return { pages, replaced: replaced() };
}

/** The document as a React element for the PDF library (decision 0078). */
function techPackDocument(pack: TechPack, images: ImageMap, options: PdfOptions = {}): ReactElement<DocumentProps> {
  registerPdfFont();
  switchHyphenationOff();
  const first = buildPages(pack, images, options, null);
  const built = first.replaced ? buildPages(pack, images, options, CHARACTERS_REPLACED) : first;
  const title = designLabel(pack, drawable);
  return h(Document, { title, creator: "Knitwright", producer: "Knitwright" }, ...built.pages);
}

/** The PDF of a tech pack, in memory. Nothing is written to disk. */
export async function buildPdf(pack: TechPack, images: ImageMap, options: PdfOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  assertEverySetCellHasSource(pack);
  return new Uint8Array(await renderToBuffer(techPackDocument(pack, images, options)));
}
