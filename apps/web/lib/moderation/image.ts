import sharp from "sharp";
import { hammingDistance, hasEnoughDetail, imageHash } from "./image-hash";
import type { ModerationSettings } from "./settings";
import { reason, type Mark, type Reason } from "./types";
import type { VisionCheck } from "./vision";

/** The longest side of the copy the vision check is sent. Smaller is cheaper; a logo is still legible. */
export const VISION_SIDE_PX = 768;

/** An upload waits at most this long for the vision check; after it, a person looks instead. */
export const VISION_TIMEOUT_MS = 20_000;

export type ImageScreenInput = Readonly<{
  bytes: Uint8Array;
  marks: readonly Mark[];
  settings: ModerationSettings;
  /** Null when no vision model is configured; the check then says it did not run. */
  vision: VisionCheck | null;
}>;

/**
 * Compares the picture's hash with every registered mark picture. A picture with almost no edges in it (plain white, a soft
 * gradient) is not compared at all: every other flat picture would be a perfect match to it, so the answer would be noise.
 */
export function hashReasons(hash: string, marks: readonly Mark[], settings: ModerationSettings): Reason[] {
  if (!hasEnoughDetail(hash)) {
    return [reason("hash_too_plain", "note", "The picture has too little in it to compare with the registered marks.")];
  }
  return marks.flatMap((mark) => {
    if (!mark.imageHash || !hasEnoughDetail(mark.imageHash)) return [];
    const distance = hammingDistance(hash, mark.imageHash);
    if (distance <= settings.imageBlockDistance) {
      return [reason("mark_image_match", "block", `This picture matches a registered mark of ${mark.holder}. Upload artwork you own.`, mark.holder)];
    }
    if (distance <= settings.imageFlagDistance) {
      return [reason("mark_image_near", "flag", `This picture looks like a registered mark of ${mark.holder}. A person will check it.`, mark.holder)];
    }
    return [];
  });
}

async function visionReasons(bytes: Uint8Array, vision: VisionCheck | null): Promise<Reason[]> {
  if (!vision) return [reason("vision_not_configured", "note", "No vision model is configured, so only the registry was checked.")];
  try {
    const png = await sharp(bytes).resize(VISION_SIDE_PX, VISION_SIDE_PX, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const finding = await vision.inspect({ mediaType: "image/png", base64: png.toString("base64") }, AbortSignal.timeout(VISION_TIMEOUT_MS));
    return [
      ...finding.marks.map((mark) => reason("vision_mark", "flag", `This may show another brand's mark ("${mark}"). A person will check it.`, mark)),
      ...(finding.offensive ? [reason("vision_offensive", "flag", "This may show offensive content. A person will check it.")] : []),
    ];
  } catch {
    // A check that could not run is not a pass: a person looks instead.
    return [reason("vision_unavailable", "flag", "The picture check could not run. A person will look at it instead.")];
  }
}

/** Screens a picture against the registry's picture hashes and, when configured, the vision model. */
export async function screenImageContent(input: ImageScreenInput): Promise<Readonly<{ hash: string; reasons: readonly Reason[] }>> {
  const hash = await imageHash(input.bytes);
  return { hash, reasons: [...hashReasons(hash, input.marks, input.settings), ...(await visionReasons(input.bytes, input.vision))] };
}
