import sharp from "sharp";
import { INTAKE_LIMITS, intakeArtwork, type Intake } from "@/lib/artwork-intake";
import { MODEL_IMAGE_TYPES, type ModelImageType } from "@/lib/providers/text-model";

/**
 * Step 1: the picture comes in through W7b's artwork intake, the same door as every other upload: the type is read
 * from the first bytes, the size and pixel limits apply, a raster is made sRGB, and a vector mockup (SVG, or a PDF
 * or Illustrator page) is drawn to a picture. The reading and the maths work on W7b's screen copy, not on the
 * stored original. Nothing here stores anything.
 */

/** The most a vision call is sent. */
export const VISION_MAX_BYTES = 5 * 1024 * 1024;
/** The longest side of a picture re-encoded for the reading model. */
const MODEL_EDGE = 1568;

interface PictureIn {
  readonly bytes: Uint8Array;
  readonly mediaType: ModelImageType;
  /** What intake said about the file, in its words. */
  readonly notes: readonly string[];
}

const isModelType = (type: string): type is ModelImageType => (MODEL_IMAGE_TYPES as readonly string[]).includes(type);

/** WebP is read by the reading model but not taken as artwork, so it is made a PNG first. Detected from the first bytes. */
async function withoutWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const webp = bytes.length > 12 && Buffer.from(bytes.subarray(0, 4)).toString("latin1") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("latin1") === "WEBP";
  if (!webp) return bytes;
  return new Uint8Array(await sharp(bytes, { limitInputPixels: INTAKE_LIMITS.maxPixels }).png().toBuffer());
}

async function forModel(intake: Intake): Promise<{ bytes: Uint8Array; mediaType: ModelImageType }> {
  const { screen } = intake;
  if (isModelType(screen.contentType) && screen.bytes.byteLength <= VISION_MAX_BYTES) return { bytes: new Uint8Array(screen.bytes), mediaType: screen.contentType };
  const smaller = await sharp(screen.bytes).flatten({ background: "#ffffff" }).resize({ width: MODEL_EDGE, height: MODEL_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { bytes: new Uint8Array(smaller), mediaType: "image/jpeg" };
}

/** Takes in the person's file. Throws W7b's plain sentence (an `AppError`) for a file it refuses. */
export async function intakePicture(bytes: Uint8Array): Promise<PictureIn> {
  const intake = await intakeArtwork(await withoutWebp(bytes), "Design picture");
  const copy = await forModel(intake);
  return { ...copy, notes: intake.warnings };
}
