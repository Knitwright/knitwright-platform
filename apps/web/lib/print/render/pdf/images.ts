import sharp from "sharp";
import type { ImageItem } from "@/lib/print/scene";
import { deflate } from "./writer";

/** A picture ready to write: colour and, when any pixel is see-through, a separate alpha channel. */
export interface PdfPicture {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly rgb: Uint8Array;
  readonly alpha: Uint8Array | null;
}

/** Each picture once, in the order the page first uses it. */
export function uniqueImages(items: readonly ImageItem[]): readonly ImageItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.imageId) ? false : Boolean(seen.add(item.imageId))));
}

export async function decodePicture(item: ImageItem): Promise<PdfPicture> {
  const { data, info } = await sharp(item.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const rgb = new Uint8Array(pixels * 3);
  const alpha = new Uint8Array(pixels);
  let see = false;
  for (let i = 0; i < pixels; i += 1) {
    rgb[i * 3] = data[i * 4] ?? 0;
    rgb[i * 3 + 1] = data[i * 4 + 1] ?? 0;
    rgb[i * 3 + 2] = data[i * 4 + 2] ?? 0;
    const a = data[i * 4 + 3] ?? 255;
    alpha[i] = a;
    if (a !== 255) see = true;
  }
  return { widthPx: info.width, heightPx: info.height, rgb: deflate(rgb), alpha: see ? deflate(alpha) : null };
}

export const imageDict = (picture: PdfPicture, softMaskId: number | null): string =>
  `/Type /XObject /Subtype /Image /Width ${picture.widthPx} /Height ${picture.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${softMaskId === null ? "" : ` /SMask ${softMaskId} 0 R`}`;

export const maskDict = (picture: PdfPicture): string =>
  `/Type /XObject /Subtype /Image /Width ${picture.widthPx} /Height ${picture.heightPx} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`;
