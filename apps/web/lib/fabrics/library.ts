import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadinessItem, SizeLabelMap } from "@/lib/production/contract";
import { sizeMapReadiness } from "@/lib/sizing";
import { listFabrics, listSavedSizeMaps, seedBenchmarkFabrics } from "./service";
import { effectiveSizeMaps } from "./size-maps";
import { fabricView, type FabricView } from "./view";

export type FabricLibrary = Readonly<{
  fabrics: readonly FabricView[];
  sizeMaps: readonly SizeLabelMap[];
  /** The open item for the size label map, for the "Ready for the factory" list. */
  sizeMapReadiness: ReadinessItem;
}>;

/**
 * Everything the fabric library page shows. The first time a brand opens it, the three fabrics
 * the benchmark names are added, with every number empty. Reads use the person's own client.
 */
export async function loadFabricLibrary(
  client: SupabaseClient,
  admin: SupabaseClient,
  who: Readonly<{ brandId: string; userId: string }>,
): Promise<FabricLibrary> {
  await seedBenchmarkFabrics(admin, who);
  const [fabrics, saved] = await Promise.all([listFabrics(client, who.brandId), listSavedSizeMaps(client, who.brandId)]);
  const sizeMaps = effectiveSizeMaps(saved);
  return { fabrics: fabrics.map(fabricView), sizeMaps, sizeMapReadiness: sizeMapReadiness(sizeMaps) };
}
