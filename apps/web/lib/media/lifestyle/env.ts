import type { Env } from "@/lib/config/env";
import type { LifestyleEnv } from "./select";

/** The provider settings of the validated environment, as the lifestyle providers read them. */
export const lifestyleEnv = (env: Env): LifestyleEnv => ({
  LIFESTYLE_SCENE_PROVIDER: env.LIFESTYLE_SCENE_PROVIDER,
  LIFESTYLE_TRYON_PROVIDER: env.LIFESTYLE_TRYON_PROVIDER,
  LIFESTYLE_DAILY_CAP_MICRODOLLARS: env.LIFESTYLE_DAILY_CAP_MICRODOLLARS,
  PHOTOROOM_API_KEY: env.PHOTOROOM_API_KEY,
  FASHN_API_KEY: env.FASHN_API_KEY,
  FAL_KEY: env.FAL_KEY,
  GOOGLE_VERTEX_ACCESS_TOKEN: env.GOOGLE_VERTEX_ACCESS_TOKEN,
  GOOGLE_VERTEX_PROJECT: env.GOOGLE_VERTEX_PROJECT,
  GOOGLE_VERTEX_LOCATION: env.GOOGLE_VERTEX_LOCATION,
});
