import type { SupabaseClient } from "@supabase/supabase-js";
import { brandChartSet } from "@/lib/charts/service";
import { flatModels } from "@/lib/images/reference";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { getProjectAt } from "@/lib/projects/service";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import type { StudioDesign } from "./studio";

/**
 * The drawings of one saved version of a design, with the pictures its artwork uses. Reads go through the member's own
 * client. Null when the type has no drawing. Joins the design's reads to the renderer; the end-to-end test covers it.
 */
export async function loadStudioDesign(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  version?: number,
): Promise<(StudioDesign & { version: number }) | null> {
  const [project, charts] = await Promise.all([getProjectAt(client, brandId, projectId, version), brandChartSet(client, brandId)]);
  const models = flatModels(project.spec, charts);
  if (!models) return null;
  const { images } = await loadArtworkImages(createFileReader(client, brandId), shrinkForDrawing, project.spec);
  return { ...models, images, version: project.currentVersion };
}
