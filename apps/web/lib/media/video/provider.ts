import type { VideoType } from "./sniff";

/** What a video model is asked: the passed lifestyle still, a length, and a fixed prompt from code (never a person's words). */
export type VideoRequest = Readonly<{ still: Uint8Array; seconds: number; prompt: string }>;

export type VideoResult =
  | Readonly<{ ok: true; video: Uint8Array; type: VideoType }>
  | Readonly<{ ok: false; message: string }>;

/** A paid image-to-video model, or the stub. Never called from tests except as the stub. */
export interface VideoProvider {
  readonly name: string;
  /** Per clip, in millionths of a dollar. Zero for the stub. */
  readonly costMicrodollars: number;
  generate(request: VideoRequest, signal: AbortSignal): Promise<VideoResult>;
}

/** The one prompt. The garment, crest and sponsors must not change; only the camera and the light move. */
export const CLIP_PROMPT =
  "Slow camera move around the football shirt on a person. Keep the shirt, its colours, stripes, crest, sponsor logos, names and numbers exactly as in the picture. Do not add text.";
