/**
 * What a file is, from its first bytes. The name and the type the browser stated are never used.
 */
export const ARTWORK_FORMATS = ["png", "jpeg", "tiff", "pdf", "svg"] as const;
export type ArtworkFormat = (typeof ARTWORK_FORMATS)[number];

export type Sniffed =
  | Readonly<{ ok: true; format: ArtworkFormat }>
  | Readonly<{ ok: false; message: string }>;

export const NOT_ACCEPTED = "Upload a PNG, JPEG, TIFF, PDF or SVG file.";
export const AI_WITHOUT_PDF =
  "This Illustrator file has no PDF inside it. Save it from Illustrator with 'Create PDF compatible file', or export a PDF or SVG.";
export const COMPRESSED_SVG = "Compressed SVG (.svgz) is not accepted. Export a plain SVG or a PDF instead.";
export const WIDE_TEXT_SVG = "That SVG is not saved as UTF-8 text. Export it again as plain UTF-8 SVG, or as a PDF.";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  String.fromCharCode(...bytes.subarray(from, Math.min(to, bytes.length)));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const TIFF_MAGICS: readonly (readonly number[])[] = [
  [0x49, 0x49, 0x2a, 0x00],
  [0x4d, 0x4d, 0x00, 0x2a],
  [0x49, 0x49, 0x2b, 0x00],
  [0x4d, 0x4d, 0x00, 0x2b],
];

/** Adobe's reader accepts the PDF header anywhere in the first kilobyte. */
const PDF_WINDOW = 1024;
const SVG_WINDOW = 4096;

const SVG_START = /^(?:<\?xml[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*(?:\[[\s\S]*?\])?\s*>\s*)*<svg[\s>/]/i;

/** The start of the file as text. Bytes that are not UTF-8 become replacement characters; the SVG reader is strict about the whole file. */
const looksLikeSvg = (bytes: Uint8Array): boolean => {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const text = new TextDecoder("utf-8").decode(bytes.subarray(start, start + SVG_WINDOW)).trimStart();
  return SVG_START.test(text);
};

export function sniffArtwork(bytes: Uint8Array): Sniffed {
  if (startsWith(bytes, PNG)) return { ok: true, format: "png" };
  if (startsWith(bytes, JPEG)) return { ok: true, format: "jpeg" };
  if (TIFF_MAGICS.some((magic) => startsWith(bytes, magic))) return { ok: true, format: "tiff" };
  if (ascii(bytes, 0, PDF_WINDOW).includes("%PDF-")) return { ok: true, format: "pdf" };
  if (startsWith(bytes, [0x1f, 0x8b])) return { ok: false, message: COMPRESSED_SVG };
  if (ascii(bytes, 0, 11).startsWith("%!PS-Adobe")) return { ok: false, message: AI_WITHOUT_PDF };
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    return { ok: false, message: WIDE_TEXT_SVG };
  }
  if (looksLikeSvg(bytes)) return { ok: true, format: "svg" };
  return { ok: false, message: NOT_ACCEPTED };
}
