import sharp, { type Metadata } from "sharp";
import { AppError } from "@/lib/server/core/errors";

/**
 * The one check every uploaded image passes before it is stored. The file is read as
 * an image and written out again, so what is stored is only pixels: no camera or
 * location details, no script, nothing that was appended to the file.
 */

export const IMAGE_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  /** Refuses images that are small as files but huge once opened. */
  maxPixels: 40_000_000,
  /** Longest side of the stored image, in pixels. */
  maxEdge: 2048,
} as const;

type SniffedType = "image/png" | "image/jpeg" | "image/webp";

type CheckedImage = Readonly<{
  bytes: Buffer;
  /** Only formats the PDF export can draw. */
  contentType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
  width: number;
  height: number;
}>;

const NOT_ACCEPTED = "Upload a PNG, JPEG or WebP image.";
const NOT_READABLE = "That file could not be read as an image.";
const TOO_MANY_BYTES = `Images can be ${IMAGE_LIMITS.maxBytes / (1024 * 1024)} MB at most.`;
const TOO_MANY_PIXELS = "That image is too large. Use one under 40 megapixels.";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/** The type the first bytes say the file is, whatever its name or stated type. */
const sniff = (bytes: Uint8Array): SniffedType | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  const isRiff = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]);
  if (isRiff && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
};

const fourCharacters = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + 4));

const RIFF_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/**
 * Whether a WebP file holds its picture without loss. The image library does not always
 * say, so this reads the file: `VP8L` is lossless and `VP8 ` is lossy. In the extended
 * format (`VP8X`) the picture sits in a later chunk, so the chunks are walked in turn.
 */
const isLosslessWebp = (bytes: Uint8Array): boolean => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = RIFF_HEADER_BYTES;
  while (offset + CHUNK_HEADER_BYTES <= bytes.byteLength) {
    const name = fourCharacters(bytes, offset);
    if (name === "VP8L") return true;
    if (name === "VP8 ") return false;
    const size = view.getUint32(offset + 4, true);
    // Chunks are padded to an even length.
    offset += CHUNK_HEADER_BYTES + size + (size % 2);
  }
  return false;
};

const readSize = async (bytes: Uint8Array): Promise<Metadata> => {
  try {
    // The pixel limit is checked by hand below, so its failure has its own message.
    return await sharp(bytes, { limitInputPixels: false }).metadata();
  } catch {
    throw new AppError("invalid_input", NOT_READABLE);
  }
};

const reencode = async (bytes: Uint8Array, asPng: boolean) => {
  const pipeline = sharp(bytes, { limitInputPixels: IMAGE_LIMITS.maxPixels, failOn: "error" })
    // Turns the image as its orientation note says. The note itself is not kept.
    .rotate()
    .resize({
      width: IMAGE_LIMITS.maxEdge,
      height: IMAGE_LIMITS.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
  const encoded = asPng
    ? pipeline.png({ compressionLevel: 9 })
    : pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true });

  try {
    return await encoded.toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError("invalid_input", NOT_READABLE);
  }
};

/**
 * The content decides the type, never the type the browser stated, because what is stored
 * is rewritten pixels under a type the server chooses.
 */
export const checkImage = async (bytes: Uint8Array): Promise<CheckedImage> => {
  if (bytes.byteLength > IMAGE_LIMITS.maxBytes) throw new AppError("too_large", TOO_MANY_BYTES);
  const type = sniff(bytes);
  if (!type) throw new AppError("invalid_input", NOT_ACCEPTED);

  const size = await readSize(bytes);
  if (!size.width || !size.height) throw new AppError("invalid_input", NOT_READABLE);
  if (size.width * size.height > IMAGE_LIMITS.maxPixels) {
    throw new AppError("too_large", TOO_MANY_PIXELS);
  }

  // PNG is kept as PNG: it is exact, which matters for the flat colours of a logo.
  // Anything see-through, and a WebP that lost nothing, must be PNG too. The rest is
  // stored as JPEG.
  const asPng =
    type === "image/png" ||
    size.hasAlpha === true ||
    (type === "image/webp" && isLosslessWebp(bytes));
  const { data, info } = await reencode(bytes, asPng);
  return {
    bytes: data,
    contentType: asPng ? "image/png" : "image/jpeg",
    extension: asPng ? "png" : "jpg",
    width: info.width,
    height: info.height,
  };
};
