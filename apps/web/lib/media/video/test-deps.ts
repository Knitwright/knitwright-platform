import sharp from "sharp";
import type { VideoFiles } from "./ports";
import { stubWebm } from "./stub";

/** In-memory stand-ins and fixtures for tests. */

export function memoryVideos(): VideoFiles & { saved: Map<string, Uint8Array>; reads: string[] } {
  const saved = new Map<string, Uint8Array>();
  const reads: string[] = [];
  return {
    saved,
    reads,
    async save(path, bytes) {
      saved.set(path, bytes);
    },
    async read(path) {
      reads.push(path);
      return saved.get(path) ?? null;
    },
    async remove(paths) {
      for (const path of paths) saved.delete(path);
    },
  };
}

export const png = async (colour = "#3366cc", width = 64, height = 48): Promise<Uint8Array> =>
  new Uint8Array(await sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer());

/** A recording a browser could send: starts with the WebM signature. */
export const webm = (tag = "a"): Uint8Array => stubWebm(new TextEncoder().encode(tag), 8);
