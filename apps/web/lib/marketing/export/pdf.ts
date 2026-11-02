import { Document, Image, Page, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h } from "react";
import type { Size } from "@/lib/launch";
import { DEFAULT_DPI } from "@/lib/launch";
import type { CmykProfile } from "./colour";

/**
 * THE PDF OF ONE ARTBOARD (spec F-L2: the full export's PDF; plan v5 L4, decision 0094).
 *
 * Its own module, because importing it pulls `@react-pdf/renderer` in, which decision 0011 keeps
 * out of anything a page loads. The writer is the one the app already ships, under MIT, and the
 * font it would set text in is the one already in `assets/fonts` (Geist, SIL OFL 1.1) -- not used
 * here, because the page holds the drawing as a picture and no live text.
 *
 * A page is the artboard's own size in points, so A4 at 300 dots per inch is an A4 page and not a
 * 2480-point one. The clock is fixed, so the same artboard gives the same file.
 */

/** PDF points: 72 to the inch, which is also `DEFAULT_DPI`. */
const POINTS_PER_INCH = DEFAULT_DPI;

/** Fixed, so the same artboard gives the same bytes. */
const CREATED = new Date(Date.UTC(2000, 0, 1));

export interface PdfInput {
  /** The page's picture: the artboard as PNG bytes, already marked if the plan says so. */
  readonly png: Uint8Array;
  /** The pixels the picture is, and the resolution they are read at, which give the page's size. */
  readonly size: Size;
  readonly dpi: number;
  readonly title: string;
  /** Named in the file when a separation was asked for, or null. */
  readonly profile: CmykProfile | null;
}

/** The page's size in points, from the pixels and the resolution they are read at. */
export const pageSize = (size: Size, dpi: number): Readonly<{ width: number; height: number }> => ({
  width: Math.round((size.width / dpi) * POINTS_PER_INCH * 100) / 100,
  height: Math.round((size.height / dpi) * POINTS_PER_INCH * 100) / 100,
});

/**
 * One artboard as a one-page PDF. The picture fills the page exactly, with no margin, because an
 * artboard is the page.
 */
export async function renderMarketingPdf(input: PdfInput): Promise<Uint8Array> {
  const { width, height } = pageSize(input.size, input.dpi);
  const page = h(
    Page,
    { size: { width, height }, style: { padding: 0 } },
    h(Image, { src: Buffer.from(input.png), style: { width, height } }),
  );
  const document = h(
    Document,
    {
      title: input.title,
      creator: "Knitwright",
      producer: "Knitwright",
      subject: input.profile ? `Separated against ${input.profile.name}` : "RGB",
      creationDate: CREATED,
      modificationDate: CREATED,
    },
    page,
  );
  return new Uint8Array(await renderToBuffer(document));
}
