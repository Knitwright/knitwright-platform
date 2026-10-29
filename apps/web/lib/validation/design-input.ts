import type { SupabaseClient } from "@supabase/supabase-js";
import { readTechPack } from "@/lib/projects/tech-pack-load";
import { buildTechPackCore } from "@/lib/projects/tech-pack-data";
import { UNWIRED_PORTS, type ValidationPorts } from "./ports";
import type { DesignInput } from "./registry";
import { specInput } from "./spec-input";

/**
 * Reads the current version of a design and builds what the checks read: the garment type, the tech pack's readiness,
 * and the base article, moderation and colour inputs of plan v5 X4.
 */
export async function readinessFor(
  client: SupabaseClient,
  brand: Readonly<{ id: string; name: string }>,
  projectId: string,
  ports: ValidationPorts = UNWIRED_PORTS,
): Promise<Readonly<{ design: DesignInput; version: number }>> {
  const { project, history, charts, memberNames, production } = await readTechPack(client, brand.id, projectId);
  const core = buildTechPackCore({ project, history, brandName: brand.name, now: new Date(), charts, memberNames, production });
  const extra = await specInput(project.spec, brand.id, ports);
  return { design: { typeId: project.spec.typeId, readiness: core.pack.readiness, ...extra }, version: project.currentVersion };
}
