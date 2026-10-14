import sharp from "sharp";
import type { ImageProvider } from "@/lib/providers/image-provider";
import type { Budget } from "./budget";
import { RASTER_UNREADABLE, decodeRaster, type Raster } from "./raster";

/**
 * An image model clean-up (remove a person or hanger, flatten a photo), used only when the classical outline fails
 * and only within the budget of 2 edits. The edit model returns a square picture, so the original is padded to a
 * square first and cropped back after. What comes back is generated pixels: the result says so, and generated
 * pixels are never print artwork unless the user accepts them (decision 0038).
 */

const SQUARE = 1024;

export const CLEANUP_PROMPT =
  "Remove any person, hanger, mannequin, shadow and background objects from this picture of a garment. Keep the garment's shape, colours and printed marks as they are. Put the garment on a plain white background. Do not add anything.";

export const CLEANUP_FAILED = "The picture could not be cleaned up just now, so the outline stays as found.";

export type CleanUpOutcome =
  | { readonly ok: true; readonly raster: Raster; readonly generated: true }
  | { readonly ok: false; readonly reason: string };

export interface CleanUp {
  run(bytes: Uint8Array, signal?: AbortSignal): Promise<CleanUpOutcome>;
}

export function createCleanUp(provider: ImageProvider, budget: Budget): CleanUp {
  return {
    async run(bytes, signal) {
      if (!budget.takeEdit()) return { ok: false, reason: CLEANUP_FAILED };
      try {
        const fitted = await sharp(bytes).rotate().flatten({ background: "#ffffff" }).resize({ width: SQUARE, height: SQUARE, fit: "inside" }).toBuffer({ resolveWithObject: true });
        const [w, h] = [fitted.info.width, fitted.info.height];
        const [left, top] = [Math.floor((SQUARE - w) / 2), Math.floor((SQUARE - h) / 2)];
        const reference = await sharp(fitted.data).extend({ top, left, bottom: SQUARE - h - top, right: SQUARE - w - left, background: "#ffffff" }).png().toBuffer();
        const edited = await provider.generate({ prompt: CLEANUP_PROMPT, reference: new Uint8Array(reference) }, signal);
        const cropped = await sharp(edited.bytes).resize({ width: SQUARE, height: SQUARE, fit: "fill" }).extract({ left, top, width: w, height: h }).png().toBuffer();
        return { ok: true, raster: await decodeRaster(new Uint8Array(cropped)), generated: true };
      } catch (error) {
        const known = error instanceof Error && error.message === RASTER_UNREADABLE;
        return { ok: false, reason: known ? RASTER_UNREADABLE : CLEANUP_FAILED };
      }
    },
  };
}
