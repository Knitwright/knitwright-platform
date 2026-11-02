import { createFalBoardVideoProvider, type Fetch } from "./fal";
import type { VideoAspect } from "./formats";
import type { VideoType } from "./sniff";
import { stubWebm } from "./stub";

/**
 * The AI video board's provider: the same idea as the clip's `VideoProvider` (decision 0058) with the
 * things the board adds -- an end frame, the aspect, the length, sound, and which model was picked.
 *
 * Two rules the shape itself carries:
 *
 *   * **the first frame is a picture the platform drew.** `firstFrame` is required, and the caller
 *     may only pass the deterministic render, a mockup or the golden-sample photo (spec F-L3). There
 *     is no field for "draw the garment from the prompt", so a provider cannot be asked for one.
 *   * **no live paid call from tests or a local run.** `chooseBoardVideoProvider` returns the stub
 *     unless `FAL_KEY` is set AND `MEDIA_VIDEO_LIVE` is exactly "true", the same two keys the clip
 *     uses (`select.ts`). CI sets neither, and the stub costs nothing and calls nothing.
 */

export interface BoardVideoRequest {
  /** The garment-locked first frame, as a PNG. */
  readonly firstFrame: Uint8Array;
  /** The end frame, when the person gave one. Both frames are pictures the platform drew. */
  readonly endFrame?: Uint8Array | undefined;
  readonly prompt: string;
  readonly seconds: number;
  readonly aspect: VideoAspect;
  /** True when the person asked for sound and the model can make one of its own. */
  readonly audio: boolean;
  readonly modelKey: string;
}

export type BoardVideoResult =
  | Readonly<{ ok: true; video: Uint8Array; type: VideoType }>
  | Readonly<{ ok: false; message: string }>;

export interface BoardVideoProvider {
  readonly name: string;
  /** What one second of video costs the platform, in millionths of a dollar. Zero for the stub. */
  readonly costPerSecondMicrodollars: number;
  generate(request: BoardVideoRequest, signal: AbortSignal): Promise<BoardVideoResult>;
}

export const STUB_BOARD_PROVIDER = "stub-board-video";

/**
 * The deterministic stub. It gives back the same placeholder WebM the clip's stub does -- a valid
 * header that says what it is and carries a hash of the frame it was made from, and **no picture
 * frames**, so it is not a playable clip and cannot be mistaken for one.
 */
export const stubBoardVideoProvider = (): BoardVideoProvider => ({
  name: STUB_BOARD_PROVIDER,
  costPerSecondMicrodollars: 0,
  async generate({ firstFrame, seconds }) {
    return { ok: true, video: stubWebm(firstFrame, seconds), type: "video/webm" };
  },
});

/** The provider in use. The stub unless the owner has turned paid video on and a key is set. */
export function chooseBoardVideoProvider(
  settings: Readonly<{ FAL_KEY?: string | undefined; MEDIA_VIDEO_LIVE?: string | undefined }>,
  fetch?: Fetch,
): BoardVideoProvider {
  if (settings.FAL_KEY && settings.MEDIA_VIDEO_LIVE === "true") {
    return createFalBoardVideoProvider({ apiKey: settings.FAL_KEY, ...(fetch ? { fetch } : {}) });
  }
  return stubBoardVideoProvider();
}

/** Whether a model makes sound of its own. Kept with the model rows, which carry no zod. */
export { audioAvailable } from "./models";
