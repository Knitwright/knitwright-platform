import type { ArtworkFormat } from "../sniff";

/**
 * The picture size a file claims, read from its first bytes by hand. It is read before the image library sees
 * the file, so a decompression bomb (a tiny file that claims an enormous picture) is turned away unopened.
 */

type ClaimedSize = Readonly<{ width: number; height: number }>;

const pngSize = (view: DataView): ClaimedSize | null =>
  view.byteLength >= 24 && view.getUint32(12) === 0x49484452 ? { width: view.getUint32(16), height: view.getUint32(20) } : null;

const jpegSize = (view: DataView): ClaimedSize | null => {
  let at = 2;
  while (at + 9 <= view.byteLength) {
    if (view.getUint8(at) !== 0xff) return null;
    const marker = view.getUint8(at + 1);
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    // Markers with no length: restart markers and the start of the picture.
    at += marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9) ? 2 : 2 + view.getUint16(at + 2);
  }
  return null;
};

const tiffSize = (view: DataView): ClaimedSize | null => {
  if (view.byteLength < 8) return null;
  const little = view.getUint16(0) === 0x4949;
  const ifd = view.getUint32(4, little);
  if (ifd + 2 > view.byteLength) return null;
  const count = Math.min(view.getUint16(ifd, little), 512);
  let width: number | null = null;
  let height: number | null = null;
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (tag !== 256 && tag !== 257) continue;
    const value = view.getUint16(entry + 2, little) === 3 ? view.getUint16(entry + 8, little) : view.getUint32(entry + 8, little);
    if (tag === 256) width = value;
    else height = value;
  }
  return width !== null && height !== null ? { width, height } : null;
};

/** The claimed size of a PNG, JPEG or TIFF, or null when the header cannot be read. */
export const claimedSize = (bytes: Uint8Array, format: Extract<ArtworkFormat, "png" | "jpeg" | "tiff">): ClaimedSize | null => {
  // A header read never needs more than the start of the file. A TIFF's first directory can sit further in.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === "png") return pngSize(view);
  if (format === "jpeg") return jpegSize(view);
  return tiffSize(view);
};
