import type { ImageProvider } from "@/lib/providers/image-provider";
import type { LifestyleProvider } from "../provider";
import { SCENE_IDS } from "../scenes";

/**
 * The existing fal client (decision 0018, `lib/providers/fal.ts`, nano-banana-2 edit), asked for a scene or a person with
 * the fixed prompt. It takes no seed, so a retry differs because the call does. Licence note: fal's commercial terms
 * as already accepted for photoreal images; fal is asked to keep nothing. Nothing new is added here.
 */

/** The price the photoreal images already reserve: $0.08 an image (lib/images/cost.ts). */
export const FAL_COST_MICRODOLLARS = 80_000;

export const createFalLifestyleProvider = (image: ImageProvider): LifestyleProvider => ({
  name: image.name,
  costMicrodollars: FAL_COST_MICRODOLLARS,
  scenes: SCENE_IDS,
  async generate({ prompt, reference }, signal) {
    return (await image.generate({ prompt, reference }, signal)).bytes;
  },
});
