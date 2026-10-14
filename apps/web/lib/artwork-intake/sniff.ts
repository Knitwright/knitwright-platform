export type ArtworkFormat = "png" | "jpeg" | "tiff" | "pdf" | "svg";

/** What the first bytes say a file is. A native Illustrator file is named so it can be refused with advice. */
export type Sniffed = ArtworkFormat | "ai-native";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (value: string): number[] => [...value].map((char) => char.charCodeAt(0));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const TIFF_LITTLE = [0x49, 0x49, 0x2a, 0x00];
const TIFF_BIG = [0x4d, 0x4d, 0x00, 0x2a];
const UTF8_BOM = [0xef, 0xbb, 0xbf];
/** A PDF reader accepts the header anywhere in the first 1024 bytes. */
const PDF_WINDOW = 1024;
const SVG_WINDOW = 64 * 1024;

const hasPdfHeader = (bytes: Uint8Array): boolean => {
  const window = bytes.subarray(0, PDF_WINDOW + 5);
  for (let at = 0; at + 5 <= window.length && at <= PDF_WINDOW - 5; at += 1) {
    if (startsWith(window, ascii("%PDF-"), at)) return true;
  }
  return false;
};

const looksLikeSvg = (bytes: Uint8Array): boolean => {
  const start = startsWith(bytes, UTF8_BOM) ? UTF8_BOM.length : 0;
  let head: string;
  try {
    head = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start, SVG_WINDOW));
  } catch {
    return false;
  }
  return /^\s*</.test(head) && /<svg[\s>/]/i.test(head);
};

/** The type the first bytes say the file is, whatever its name or stated type. Null when it is none we take. */
export const sniffArtwork = (bytes: Uint8Array): Sniffed | null => {
  if (startsWith(bytes, PNG)) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, TIFF_LITTLE) || startsWith(bytes, TIFF_BIG)) return "tiff";
  if (hasPdfHeader(bytes)) return "pdf";
  if (startsWith(bytes, ascii("%!PS-Adobe"))) return "ai-native";
  return looksLikeSvg(bytes) ? "svg" : null;
};
