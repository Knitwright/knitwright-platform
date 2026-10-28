import { createFalProvider } from "./fal";
import { createGeminiProvider } from "./gemini";
import type { ImageProvider } from "./image-provider";

export type { GeneratedImage, ImageProvider, ImageRequest } from "./image-provider";
export { ProviderError } from "./image-provider";
export { buildImagePrompt } from "./prompt";

type ImageProviderEnv = Readonly<{ GEMINI_API_KEY?: string; FAL_KEY?: string; IMAGE_PROVIDER?: "gemini" | "fal" }>;

/**
 * The image provider the configuration names, or null when its key is not set. Null means the
 * feature is shown as unavailable; nothing else in the product depends on it. IMAGE_PROVIDER
 * picks one; without it, Google directly is used when its key is set, then fal.
 */
export function imageProviderFrom(env: ImageProviderEnv): ImageProvider | null {
  const gemini = () => (env.GEMINI_API_KEY ? createGeminiProvider({ apiKey: env.GEMINI_API_KEY }) : null);
  const fal = () => (env.FAL_KEY ? createFalProvider({ apiKey: env.FAL_KEY }) : null);
  if (env.IMAGE_PROVIDER === "fal") return fal();
  if (env.IMAGE_PROVIDER === "gemini") return gemini();
  return gemini() ?? fal();
}
