import type { GenerateRequest, GeneratorResult, MediaGenerator } from "./contract";
import { STUDIO_PROVIDER, renderStudioSet, type StudioDesign } from "./studio";

export const NO_DESIGN_MESSAGE = "The design could not be drawn, so no media was made. Nothing was charged.";

/** Makes the studio renders. `loadDesign` returns the drawings of the saved version, or null when there are none. */
export const studioGenerator = (loadDesign: (design: GenerateRequest["design"]) => Promise<StudioDesign | null>): MediaGenerator => ({
  name: STUDIO_PROVIDER,
  async generate(request): Promise<GeneratorResult> {
    const design = await loadDesign(request.design);
    if (!design) return { ok: false, message: NO_DESIGN_MESSAGE };
    return { ok: true, media: await renderStudioSet(design) };
  },
});
