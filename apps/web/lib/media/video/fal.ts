import { z } from "zod";
import type { BoardVideoProvider, BoardVideoRequest } from "./board-provider";
import { MAX_CLIP_BYTES } from "./limits";
import type { VideoProvider } from "./provider";
import { sniffVideo } from "./sniff";

/**
 * Kling image-to-video, resold by fal.ai and called over plain HTTPS, written from fal's public model page. Chosen by the
 * spec ("Kling on fal, or Wan"). It runs only when `FAL_KEY` is set AND the owner turns video on (see `select.ts`); tests
 * use a fake `fetch` and recorded answers, and no test reaches the network. NOT run against the live service by this workstream.
 */

export const FAL_VIDEO_MODEL = "fal-ai/kling-video/v2.1/standard/image-to-video";
const ENDPOINT = `https://fal.run/${FAL_VIDEO_MODEL}`;
/** About $0.25 for five seconds, from fal's model page (not re-checked on the day it was written). A labelled estimate. */
export const FAL_VIDEO_COST_MICRODOLLARS = 250_000;
/** A video is fetched only from fal's file host, never from an address the answer names elsewhere. */
const FILE_HOST = /^https:\/\/(?:[a-z0-9-]+\.)*fal\.media\//;

const answerSchema = z.object({ video: z.object({ url: z.string() }).optional() });

/** The body, read piece by piece; null as soon as it passes `max`, so a body with no declared length is never held whole. */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const pieces: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > max) {
      await reader.cancel();
      return null;
    }
    pieces.push(value);
  }
  return new Uint8Array(Buffer.concat(pieces));
}

export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

const refused = (message: string) => ({ ok: false, message }) as const;
const FAILED = "The video model could not make the clip. Nothing was charged.";

export function createFalVideoProvider({ apiKey, fetch: fetcher = fetch }: Readonly<{ apiKey: string; fetch?: Fetch }>): VideoProvider {
  return {
    name: `fal:${FAL_VIDEO_MODEL}`,
    costMicrodollars: FAL_VIDEO_COST_MICRODOLLARS,
    async generate({ still, seconds, prompt }, signal) {
      try {
        const response = await fetcher(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Key ${apiKey}`, "x-fal-store-io": "0" },
          body: JSON.stringify({ prompt, image_url: `data:image/png;base64,${Buffer.from(still).toString("base64")}`, duration: String(seconds) }),
          signal,
        });
        if (!response.ok) return refused(FAILED);
        const parsed = answerSchema.safeParse(await response.json());
        const url = parsed.success ? parsed.data.video?.url : undefined;
        if (!url || !FILE_HOST.test(url)) return refused(FAILED);
        const file = await fetcher(url, { method: "GET", signal });
        if (!file.ok || Number(file.headers.get("content-length") ?? 0) > MAX_CLIP_BYTES) return refused(FAILED);
        const video = await readCapped(file, MAX_CLIP_BYTES);
        const type = video && sniffVideo(video);
        return video && type ? { ok: true, video, type } : refused(FAILED);
      } catch {
        return refused(FAILED);
      }
    },
  };
}

/**
 * The same model, called with what the AI video board adds: an end frame, the aspect and the length
 * (spec F-L3). Written from fal's public model page like the clip adapter above, and **never called
 * by a test or by this workstream**: `chooseBoardVideoProvider` returns it only when `FAL_KEY` is set
 * and `MEDIA_VIDEO_LIVE` is exactly "true". Its own test uses a fake `fetch`.
 *
 * `costPerSecondMicrodollars` is the clip price divided by the five seconds fal quotes it for: a
 * labelled estimate of what the platform pays, not the credits a brand is charged. Credits a second
 * are a platform setting (`model-settings.ts`), because they are a price and prices are the owner's.
 */
export const FAL_VIDEO_COST_PER_SECOND_MICRODOLLARS = Math.round(FAL_VIDEO_COST_MICRODOLLARS / 5);

const dataUrl = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

const boardBody = (request: BoardVideoRequest): Record<string, unknown> => ({
  prompt: request.prompt,
  image_url: dataUrl(request.firstFrame),
  ...(request.endFrame ? { tail_image_url: dataUrl(request.endFrame) } : {}),
  duration: String(request.seconds),
  aspect_ratio: request.aspect,
});

export function createFalBoardVideoProvider({ apiKey, fetch: fetcher = fetch }: Readonly<{ apiKey: string; fetch?: Fetch }>): BoardVideoProvider {
  return {
    name: `fal:${FAL_VIDEO_MODEL}`,
    costPerSecondMicrodollars: FAL_VIDEO_COST_PER_SECOND_MICRODOLLARS,
    async generate(request, signal) {
      try {
        const response = await fetcher(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Key ${apiKey}`, "x-fal-store-io": "0" },
          body: JSON.stringify(boardBody(request)),
          signal,
        });
        if (!response.ok) return refused(FAILED);
        const parsed = answerSchema.safeParse(await response.json());
        const url = parsed.success ? parsed.data.video?.url : undefined;
        if (!url || !FILE_HOST.test(url)) return refused(FAILED);
        const file = await fetcher(url, { method: "GET", signal });
        if (!file.ok || Number(file.headers.get("content-length") ?? 0) > MAX_CLIP_BYTES) return refused(FAILED);
        const video = await readCapped(file, MAX_CLIP_BYTES);
        const type = video && sniffVideo(video);
        return video && type ? { ok: true, video, type } : refused(FAILED);
      } catch {
        return refused(FAILED);
      }
    },
  };
}
