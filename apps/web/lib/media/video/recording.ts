import sharp from "sharp";
import { AppError } from "@/lib/server/core/errors";
import { MAX_POSTER_BYTES, MAX_POSTER_SIDE, MAX_TURNTABLE_BYTES } from "./limits";
import { sniffVideo, type VideoType } from "./sniff";

export const NOT_A_VIDEO_MESSAGE = "That recording is not a video this studio can keep. Record it again in a current browser.";
export const TOO_LARGE_MESSAGE = "That recording is too large to keep. Record a shorter one.";
export const NO_POSTER_MESSAGE = "The recording has no still picture with it. Record it again.";

type CheckedRecording = Readonly<{ video: Uint8Array; type: VideoType; poster: Uint8Array; width: number; height: number }>;

/**
 * Checks what a browser sent for a turntable: the video by its first bytes and size, the still picture by decoding it.
 * The still is rewritten as a plain PNG, so nothing but pixels is kept from it. The length of the recording is capped by
 * the recorder in the browser and, here, by the size; the server does not decode the video.
 */
export async function checkRecording(input: Readonly<{ video: Uint8Array; poster: Uint8Array }>): Promise<CheckedRecording> {
  const type = sniffVideo(input.video);
  if (!type) throw new AppError("invalid_input", NOT_A_VIDEO_MESSAGE);
  if (input.video.byteLength > MAX_TURNTABLE_BYTES) throw new AppError("invalid_input", TOO_LARGE_MESSAGE);
  if (input.poster.byteLength === 0 || input.poster.byteLength > MAX_POSTER_BYTES) throw new AppError("invalid_input", NO_POSTER_MESSAGE);
  try {
    const decoded = sharp(input.poster, { limitInputPixels: MAX_POSTER_SIDE * MAX_POSTER_SIDE });
    const meta = await decoded.metadata();
    if (!meta.width || !meta.height || meta.width > MAX_POSTER_SIDE || meta.height > MAX_POSTER_SIDE) throw new Error("size");
    const { data, info } = await decoded.png().toBuffer({ resolveWithObject: true });
    return { video: input.video, type, poster: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw new AppError("invalid_input", NO_POSTER_MESSAGE);
  }
}
