import sharp from "sharp";
import { ProviderError, type ImageProvider } from "@/lib/providers";
import type { CleanupTask, ImageCleanup } from "./cleanup";
import { decodeForAnalysis } from "./decode";
import type { Raster } from "./raster";

/** The prompts are fixed. Nothing a person typed, and nothing read from a picture, is ever part of one. */
const PROMPTS: Readonly<Record<CleanupTask, string>> = {
  "flatten-photo":
    "Redraw this photo of a garment as a flat front view of the garment alone, laid flat on a plain white background. Keep the shape, the colours, the stripes and the marks exactly where they are. Do not add anything.",
  "remove-person-or-hanger":
    "Remove any person, mannequin or hanger from this picture so that only the garment is left on a plain white background. Keep the garment's shape, colours, stripes and marks unchanged. Do not add anything.",
};

/** A clean-up that asks an image model (fal's edit model) and reads its answer back to pixels. */
export function createImageCleanup(provider: ImageProvider): ImageCleanup {
  return {
    async run(raster: Raster, task: CleanupTask, signal?: AbortSignal): Promise<Raster> {
      const png = await sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 4 } }).png().toBuffer();
      const answer = await provider.generate({ prompt: PROMPTS[task], reference: new Uint8Array(png) }, signal);
      const decoded = await decodeForAnalysis(answer.bytes);
      if (!decoded.ok) throw new ProviderError("The image model's answer was not a picture.", false);
      return decoded.raster;
    },
  };
}
