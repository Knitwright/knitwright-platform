import type { Size } from "@/lib/launch";
import type { SlotFill } from "../assets";
import type { PlacedSlot } from "../layout";
import type { ColourRole, MarketingSlot } from "../templates/types";

/**
 * THE LAYOUT AS SVG (plan v5 L4, decision 0094).
 *
 * One drawing, which every export is made from: the SVG file itself, and the pixels sharp makes
 * from it for a PNG or a JPEG, and the page a PDF puts that PNG on. One drawing means a PNG and an
 * SVG of the same artboard cannot disagree.
 *
 * Three things it does **not** do, each on purpose:
 *
 *   * it draws no garment. A mockup slot is a picture the platform already drew, placed as an
 *     `<image>`; when the caller has no bytes for it, the slot is drawn as a labelled empty frame
 *     and nothing is invented in its place;
 *   * it embeds no font. Text is set in the generic families the brand's styles name, because no
 *     third-party font file may be committed and the brand's own fonts are Brand Studio's (Y6/Y7).
 *     The PDF's own font is the one the app already ships (Geist, SIL OFL 1.1);
 *   * it has no clock and no random id, so the same layout gives the same bytes every time.
 */

/** The colour each role resolves to, from the brand kit or the layout's own fallback. */
export type ColourMap = Readonly<Partial<Record<ColourRole, string>>>;

export interface DrawInput {
  readonly size: Size;
  readonly slots: readonly PlacedSlot[];
  readonly fills: ReadonlyMap<string, SlotFill>;
  /** `data:` URIs of the pictures the platform drew, by slot id. A slot with none is drawn empty. */
  readonly pictures: ReadonlyMap<string, string>;
  readonly colours: ColourMap;
  /** False for "Remove background": the background slot is not drawn at all, so the file is transparent. */
  readonly withBackground: boolean;
  /** The watermark's own markup, from `lib/media/watermark.ts`, or null. */
  readonly watermark: string | null;
}

/** The generic families the three brand styles are set in while no brand font is on file. */
const FAMILY: Readonly<Record<string, string>> = {
  headline: "Helvetica, Arial, sans-serif",
  subheadline: "Helvetica, Arial, sans-serif",
  body: "Helvetica, Arial, sans-serif",
};

const WEIGHT: Readonly<Record<string, number>> = { headline: 700, subheadline: 600, body: 400 };

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

const colourOf = (slot: MarketingSlot, colours: ColourMap, fallback: string): string => colours[slot.colourRole] ?? fallback;

/** The type size a text slot is drawn at: its own height, which is a fraction of the artboard. */
const fontSize = (placed: PlacedSlot): number => Math.max(8, Math.round(placed.height * 0.6));

function words(placed: PlacedSlot, fill: SlotFill, colours: ColourMap): string {
  if (fill.kind !== "words") return "";
  const style = placed.slot.style ?? "body";
  const size = fontSize(placed);
  const x = placed.x;
  const y = placed.y + size;
  return `<text x="${x}" y="${y}" font-family="${FAMILY[style]}" font-size="${size}" font-weight="${WEIGHT[style]}" fill="${colourOf(placed.slot, colours, "#111111")}">${escape(fill.text)}</text>`;
}

function picture(placed: PlacedSlot, href: string): string {
  // The picture keeps the slot's own rectangle and is cropped to fill it: the rectangle never moves.
  return `<image x="${placed.x}" y="${placed.y}" width="${placed.width}" height="${placed.height}" href="${escape(href)}" preserveAspectRatio="xMidYMid slice"/>`;
}

function emptyFrame(placed: PlacedSlot): string {
  const label = escape(placed.slot.label);
  return [
    `<rect x="${placed.x}" y="${placed.y}" width="${placed.width}" height="${placed.height}" fill="none" stroke="#9aa0a6" stroke-width="2" stroke-dasharray="8 6"/>`,
    `<title>${label}</title>`,
  ].join("");
}

function shape(placed: PlacedSlot, colours: ColourMap): string {
  return `<rect x="${placed.x}" y="${placed.y}" width="${placed.width}" height="${placed.height}" fill="${colourOf(placed.slot, colours, "#ffffff")}"/>`;
}

function one(placed: PlacedSlot, input: DrawInput): string {
  const fill = input.fills.get(placed.slot.id);
  if (placed.slot.kind === "shape") {
    const isBackdrop = placed.width >= input.size.width && placed.height >= input.size.height;
    if (isBackdrop && !input.withBackground) return "";
    return shape(placed, input.colours);
  }
  if (placed.slot.kind === "text" || placed.slot.kind === "qr") {
    return fill ? words(placed, fill, input.colours) : emptyFrame(placed);
  }
  const href = input.pictures.get(placed.slot.id);
  return href ? picture(placed, href) : emptyFrame(placed);
}

/** The whole artboard as one SVG document, in the layout's own order. */
export function layoutSvg(input: DrawInput): string {
  const body = input.slots.map((placed) => one(placed, input)).join("");
  const mark = input.watermark ?? "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${input.size.width}" height="${input.size.height}" viewBox="0 0 ${input.size.width} ${input.size.height}">`,
    body,
    mark,
    "</svg>",
  ].join("");
}
