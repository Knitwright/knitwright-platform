import { Document, Font, Page, Text, View, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { ImageMap } from "@/lib/flat/images";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/flat/pdf-font";
import { TO_BE_CONFIRMED } from "../../cell";
import type { TechPack } from "../../types";
import { assertEverySetCellHasSource } from "../guard";
import { drawable, hasUndrawable } from "../pdf-text";
import type { ExportIllustrations } from "../illustrations";
import { exportSections } from "../tables";
import { illustrationsElement } from "./illustrations";
import { paragraph } from "./parts";
import { sectionElement } from "./sections";
import { COLOURS, MARGIN, SIZES } from "./styles";

/** Said on the cover when a character the font lacks was shown as a question mark. It holds no digit. */
export const CHARACTERS_REPLACED = "Some characters could not be drawn in this file, so each is shown as a question mark.";

export interface PdfOptions {
  /** True when a picture was left out for size, so the document says so in words. */
  readonly pictureLeftOut?: boolean;
  /** AI pictures of the design, added after the specification and labelled as illustrations. */
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

const titleBlock = (pack: TechPack, safe: (text: string) => string): ReactElement =>
  h(
    View,
    { key: "title" },
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.muted } }, safe(pack.title)),
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.title, color: COLOURS.ink, marginTop: 2 } }, designLabel(pack, safe)),
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.muted, marginTop: 2 } }, `Version ${pack.cover.version}`),
  );

let hyphenationOff = false;

/** Words are never split with a hyphen at the end of a line, so the text reads back as it was written. */
function switchHyphenationOff(): void {
  if (hyphenationOff) return;
  Font.registerHyphenationCallback((word) => [word]);
  hyphenationOff = true;
}

/** The document as a React element for the PDF library. It holds every section, and a footer on every page. */
export function techPackDocument(pack: TechPack, images: ImageMap, options: PdfOptions = {}): ReactElement<DocumentProps> {
  registerPdfFont();
  switchHyphenationOff();
  const { safe, replaced } = safety();
  const context = { pack, images, safe, pictureLeftOut: options.pictureLeftOut === true };
  const sections = exportSections(pack).map((section) => sectionElement(section, context));
  const head = titleBlock(pack, safe);
  const pictures = options.illustrations ? [illustrationsElement(options.illustrations, safe)] : [];
  const note = replaced() ? [paragraph(CHARACTERS_REPLACED, safe, "replaced")] : [];
  return h(
    Document,
    { title: designLabel(pack, safe), creator: "Knitwright", producer: "Knitwright" },
    h(
      Page,
      {
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
      head,
      ...note,
      ...sections,
      ...pictures,
      footer(pack, safe),
    ),
  );
}

/** The PDF of a tech pack, in memory. Nothing is written to disk. */
export async function buildPdf(pack: TechPack, images: ImageMap, options: PdfOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  assertEverySetCellHasSource(pack);
  return new Uint8Array(await renderToBuffer(techPackDocument(pack, images, options)));
}
