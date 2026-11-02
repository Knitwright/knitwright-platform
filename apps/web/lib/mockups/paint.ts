import sharp, { type Sharp } from "sharp";
import type { Backdrop } from "./types";

/**
 * The pieces of a mockup this workstream paints itself: the backdrop, the shadow under the garment,
 * the hanger it hangs from and the folds it is folded into.
 *
 * **Not one pixel of any of them comes from anybody else.** No photograph, texture, font or model is
 * committed to this repository (plan v5 rules), so a wall is a painted colour, a pitch is a plain
 * outfield green and a hanger is a line drawing. Every one of them says so in the backdrop's own
 * note, which the panel prints beside the scene.
 *
 * Everything here is deterministic: no random number, no clock and no locale, so one design and one
 * scene give the same bytes every time.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

const png = (image: Sharp): Promise<Buffer> => image.png({ compressionLevel: 9 }).toBuffer();

/** `#rrggbb` as sharp's own colour. */
export function rgbOf(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** A straight top-to-bottom gradient between two colours, as an SVG we draw ourselves. */
const gradientSvg = (size: Size, from: string, to: string): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
      `</linearGradient></defs>` +
      `<rect width="${size.width}" height="${size.height}" fill="url(#g)"/></svg>`,
  );

/** The backdrop of a scene at this size. A gradient where the backdrop has two colours, else flat. */
export async function backdropLayer(backdrop: Backdrop, size: Size): Promise<Buffer> {
  if (backdrop.kind === "gradient" && backdrop.hexTwo !== undefined) {
    return png(sharp(gradientSvg(size, backdrop.hex, backdrop.hexTwo)));
  }
  return png(sharp({ create: { width: size.width, height: size.height, channels: 3, background: rgbOf(backdrop.hex) } }));
}

/** How dark and how soft a shadow is. A labelled default: it says how a picture looks, nothing more. */
export const SHADOW = { opacity: 0.3, blur: 16, dx: 10, dy: 18 } as const;

/**
 * The shadow of a picture: its own outline, blurred and faded. Taken from the alpha channel, so a
 * garment's real shape casts the shadow rather than its bounding box.
 */
export async function shadowOf(picture: Buffer, blur: number = SHADOW.blur, opacity: number = SHADOW.opacity): Promise<Buffer> {
  const meta = await sharp(picture).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const alpha = await sharp(picture).ensureAlpha().extractChannel(3).toBuffer();
  const shade = await png(
    sharp({ create: { width, height, channels: 3, background: "#000000" } })
      .joinChannel(alpha)
      .blur(Math.max(0.3, blur)),
  );
  return png(sharp(shade).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]));
}

/**
 * A clothes hanger, drawn as a line: a hook, a neck and two shoulders. It sits above the garment and
 * is the full width of the slot.
 */
export function hangerSvg(size: Size, hex: string): Buffer {
  const { width, height } = size;
  const stroke = Math.max(2, Math.round(height * 0.07));
  const midX = width / 2;
  const hookTop = stroke;
  const hookBottom = height * 0.55;
  const bar = height * 0.95;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g fill="none" stroke="${hex}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M ${midX} ${hookBottom} L ${midX} ${height * 0.3} ` +
      `C ${midX} ${hookTop} ${midX - width * 0.06} ${hookTop} ${midX - width * 0.06} ${height * 0.22}"/>` +
      `<path d="M ${midX} ${hookBottom} L ${stroke} ${bar} L ${width - stroke} ${bar} Z"/>` +
      `</g></svg>`,
  );
}

/** The hanger as a picture. */
export const hangerLayer = (size: Size, hex: string): Promise<Buffer> => png(sharp(hangerSvg(size, hex)));

/**
 * The garment folded into a stack: the middle band of the drawing, laid three times with a small
 * offset and a shadow between the layers. It is the drawing folded, not a photograph of a fold.
 */
export async function foldedStack(picture: Buffer, size: Size, layers = 3): Promise<Buffer> {
  const meta = await sharp(picture).metadata();
  const sourceWidth = meta.width ?? 1;
  const sourceHeight = meta.height ?? 1;
  const bandHeight = Math.max(1, Math.round(sourceHeight / 3));
  const band = await png(
    sharp(picture)
      .extract({ left: 0, top: Math.round((sourceHeight - bandHeight) / 2), width: sourceWidth, height: bandHeight })
      .resize({ width: Math.max(1, Math.round(size.width * 0.9)), height: Math.max(1, Math.round(size.height / layers)), fit: "fill" }),
  );
  const bandMeta = await sharp(band).metadata();
  const step = Math.max(1, Math.round((size.height - (bandMeta.height ?? 1)) / Math.max(1, layers - 1)));
  const shade = await shadowOf(band, 8, 0.24);
  const left = Math.round((size.width - (bandMeta.width ?? 1)) / 2);
  const pieces = Array.from({ length: layers }, (_, at) => {
    const top = at * step;
    const nudge = Math.round(((at % 2 === 0 ? 1 : -1) * size.width) / 60);
    return [
      { input: shade, left: left + nudge, top: top + 4 },
      { input: band, left: left + nudge, top },
    ];
  }).flat();
  return png(sharp({ create: { width: size.width, height: size.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(pieces));
}

/**
 * The inner shade of a ghost mannequin: the garment with a soft dark edge inside the neckline, so it
 * reads as filled out rather than flat. Drawn from the picture's own outline, never from a body.
 */
export async function ghostShade(picture: Buffer, size: Size): Promise<Buffer> {
  const neck = await png(
    sharp(picture)
      .resize({ width: Math.max(1, Math.round(size.width * 0.86)), height: Math.max(1, Math.round(size.height * 0.86)), fit: "inside" })
      .modulate({ brightness: 0.55 })
      .blur(Math.max(0.3, size.width / 90)),
  );
  const meta = await sharp(neck).metadata();
  return png(
    sharp({ create: { width: size.width, height: size.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
      { input: neck, left: Math.round((size.width - (meta.width ?? 1)) / 2), top: Math.round(size.height * 0.04) },
    ]),
  );
}

/** The picture fitted inside this box, keeping its shape, on nothing. */
export async function fitted(picture: Buffer | Uint8Array, size: Size): Promise<Buffer> {
  return png(
    sharp(Buffer.from(picture))
      .ensureAlpha()
      .resize({ width: Math.max(1, size.width), height: Math.max(1, size.height), fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  );
}

/** The size and the bytes of a picture, which the compositor needs to place it. */
export async function measured(picture: Buffer): Promise<Size> {
  const meta = await sharp(picture).metadata();
  return { width: meta.width ?? 1, height: meta.height ?? 1 };
}

/** The picture as a PNG on the given background, flattened, which is what a mockup is handed back as. */
export const flattenedPng = (image: Sharp): Promise<Buffer> => png(image);
