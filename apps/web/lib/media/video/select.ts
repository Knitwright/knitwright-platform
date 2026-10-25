import { createFalVideoProvider, type Fetch } from "./fal";
import type { VideoProvider } from "./provider";
import { stubVideoProvider } from "./stub";

/**
 * The video model in use. The stub, unless a fal key is set AND `MEDIA_VIDEO_LIVE` is exactly "true", so a key that is there for
 * images alone never starts paid video by accident. CI sets neither.
 */
export function chooseVideoProvider(settings: Readonly<{ FAL_KEY?: string | undefined; MEDIA_VIDEO_LIVE?: string | undefined }>, fetch?: Fetch): VideoProvider {
  if (settings.FAL_KEY && settings.MEDIA_VIDEO_LIVE === "true") return createFalVideoProvider({ apiKey: settings.FAL_KEY, ...(fetch ? { fetch } : {}) });
  return stubVideoProvider();
}
