import { MODEL_IMAGE_TYPES, type ModelImage, type ModelImageType } from "@/lib/providers/text-model";
import { AppError } from "@/lib/server/core/errors";
import { TOO_LARGE, type FileReader } from "@/lib/storage/read";

/**
 * A photo intake reads the member's **own** uploaded picture and nothing else. The reader is built from their own
 * client and filtered to the brand they are working in (lib/storage/read.ts), so a file id from another brand is
 * simply not there. No third-party image is ever fetched, and the picture is not stored again — it stays the brand's
 * private upload, and only the card is kept (spec F-S2 "Stored").
 */

/** A photograph of a shop shelf is a photograph, not a print file: a few megabytes is plenty. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const PHOTO_NOT_FOUND = "That photo could not be found in your brand's files.";
export const PHOTO_TOO_LARGE = "That photo is too large to read. Upload one under 8 MB.";
export const PHOTO_WRONG_TYPE = "A benchmark photo is a JPEG, PNG or WebP picture.";

/** The picture types a vision model takes. Anything else is refused rather than sent and charged for. */
export const imageType = (contentType: string): ModelImageType | null =>
  MODEL_IMAGE_TYPES.find((known) => known === contentType.split(";")[0]?.trim().toLowerCase()) ?? null;

export async function imageForCard(reader: FileReader, fileId: string): Promise<ModelImage> {
  const read = await reader.read(fileId, MAX_PHOTO_BYTES);
  if (read === TOO_LARGE) throw new AppError("invalid_input", PHOTO_TOO_LARGE);
  if (read === null) throw new AppError("not_found", PHOTO_NOT_FOUND);
  const mediaType = imageType(read.contentType);
  if (mediaType === null) throw new AppError("invalid_input", PHOTO_WRONG_TYPE);
  return { mediaType, base64: Buffer.from(read.bytes).toString("base64") };
}
