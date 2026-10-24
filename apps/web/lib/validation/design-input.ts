import type { SupabaseClient } from "@supabase/supabase-js";
import { readTechPack } from "@/lib/projects/tech-pack-load";
import { buildTechPackCore } from "@/lib/projects/tech-pack-data";
import type { DesignInput } from "./registry";

/** Reads the current version of a design and builds what the checks read: the garment type and the tech pack's readiness. */
export async function readinessFor(
  client: SupabaseClient,
  brand: Readonly<{ id: string; name: string }>,
  projectId: string,
): Promise<Readonly<{ design: DesignInput; version: number }>> {
  const { project, history, charts, memberNames, production } = await readTechPack(client, brand.id, projectId);
  const core = buildTechPackCore({ project, history, brandName: brand.name, now: new Date(), charts, memberNames, production });
  return { design: { typeId: project.spec.typeId, readiness: core.pack.readiness }, version: project.currentVersion };
}
