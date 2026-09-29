import { createGeminiProvider } from "./gemini";
import type { ImageProvider } from "./image-provider";

export type { GeneratedImage, ImageProvider, ImageRequest } from "./image-provider";
export { ProviderError } from "./image-provider";
export { buildImagePrompt } from "./prompt";

/**
 * The image provider the configuration names, or null when no key is set. Null means the
 * feature is shown as unavailable; nothing else in the product depends on it.
 */
export function imageProviderFrom(env: Readonly<{ GEMINI_API_KEY?: string }>): ImageProvider | null {
  return env.GEMINI_API_KEY ? createGeminiProvider({ apiKey: env.GEMINI_API_KEY }) : null;
}
