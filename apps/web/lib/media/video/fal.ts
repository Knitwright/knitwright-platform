import { z } from "zod";
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
        const video = new Uint8Array(await file.arrayBuffer());
        const type = sniffVideo(video);
        return type && video.byteLength <= MAX_CLIP_BYTES ? { ok: true, video, type } : refused(FAILED);
      } catch {
        return refused(FAILED);
      }
    },
  };
}
