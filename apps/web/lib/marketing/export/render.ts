import sharp from "sharp";
import { watermarkSvg } from "@/lib/media/watermark";
import type { Size } from "@/lib/launch";
import { colourVerdict, type CmykProfile } from "./colour";
import type { ColourSpace, FileFormat } from "./targets";

/**
 * MAKING THE BYTES (plan v5 L4, decision 0094).
 *
 * One drawing (`svg.ts`) becomes a file: the SVG itself, or pixels through `sharp`, which the app
 * already ships. The watermark is **the platform's existing one** -- `watermarkSvg` from
 * `lib/media/watermark.ts`, the same mark the media sets use -- composited into the same pipeline.
 * Nothing here draws a second watermark, and nothing here writes a PDF: `pdf.ts` does that, so a
 * caller that only wants a PNG does not pull a PDF writer in (decision 0011).
 *
 * `sharp` reads SVG, so the drawing is rendered once and the format decides the rest. Quality and
 * compression are fixed, so the same artboard gives the same bytes.
 */

/** What the export panel settled on, plus the drawing to make it from. */
export interface RenderInput {
  readonly drawing: string;
  readonly size: Size;
  readonly format: FileFormat;
  readonly colourSpace: ColourSpace;
  /** True when the plan's rule says this export carries the mark. */
  readonly watermark: boolean;
  /** The profile a CMYK file is separated against, or null. */
  readonly profile: CmykProfile | null;
  /** False when "Remove background" is on, so a PNG keeps its transparency. */
  readonly withBackground: boolean;
}

/** "Optimise quality" in the spec's panel. Fixed figures, so a file is the same every time. */
const JPEG_QUALITY = 88;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const encoder = new TextEncoder();

/** The mark over a drawing, from the platform's own watermark, or nothing. */
const mark = (input: RenderInput): readonly { input: Buffer; top: number; left: number }[] =>
  input.watermark ? [{ input: Buffer.from(watermarkSvg(input.size.width, input.size.height)), top: 0, left: 0 }] : [];

/** The drawing as pixels, at the size it was laid out for. */
const pixels = (input: RenderInput) =>
  sharp(Buffer.from(input.drawing), { density: 72 })
    .resize(input.size.width, input.size.height, { fit: "fill" })
    .composite([...mark(input)]);

async function png(input: RenderInput): Promise<Uint8Array> {
  const out = await pixels(input).png({ compressionLevel: 9 }).toBuffer();
  return new Uint8Array(out);
}

async function jpeg(input: RenderInput): Promise<Uint8Array> {
  // A JPEG has no transparency, so the background is filled rather than left to come back as black.
  const flat = pixels(input).flatten({ background: WHITE });
  const coloured = input.colourSpace === "cmyk" ? flat.toColourspace("cmyk") : flat;
  const out = await coloured.jpeg({ quality: JPEG_QUALITY, chromaSubsampling: "4:4:4" }).toBuffer();
  return new Uint8Array(out);
}

/**
 * The file for one artboard. A format the platform cannot make in the colour space asked for throws
 * rather than returning something else: the panel refuses it first (`panel.ts`), and this is the
 * floor under that.
 */
export async function renderBytes(input: RenderInput): Promise<Uint8Array> {
  const colour = colourVerdict(input.colourSpace, input.format, input.profile);
  if (!colour.ok) throw new Error(colour.reason);
  if (input.format === "svg") return encoder.encode(input.drawing);
  if (input.format === "jpeg") return jpeg(input);
  if (input.format === "png") return png(input);
  throw new Error("A PDF is made by renderMarketingPdf, which keeps the PDF writer out of this module.");
}

/** The PNG a PDF page is drawn from, always RGB and always with the mark the plan asks for. */
export const pageImage = (input: RenderInput): Promise<Uint8Array> => png({ ...input, colourSpace: "rgb", format: "png" });
