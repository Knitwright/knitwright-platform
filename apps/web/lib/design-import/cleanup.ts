import type { Raster } from "./raster";

/**
 * An image-model clean-up for a picture the classical outline cannot read (plan W7d step 3): take out a person
 * or a hanger, or flatten a photo. It is used only when the outline fails, at most twice per import. What it
 * gives back is generated, so the report says so, and its pixels are never print artwork unless a person accepts
 * them. Server only; the provider (fal's edit model) is wired by the route.
 */
export type CleanupTask = "remove-person-or-hanger" | "flatten-photo";

export interface ImageCleanup {
  run(raster: Raster, task: CleanupTask, signal?: AbortSignal): Promise<Raster>;
}
