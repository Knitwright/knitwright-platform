import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { readTechPack } from "@/lib/projects/tech-pack-load";
import { saveTrustedActions } from "@/lib/projects/service";
import { loadFactoryProfile } from "@/lib/validation/service";
import { decideApply, findVariant, variantsFor } from "./apply";
import { validationGate } from "./gate";
import { variantTiles, type VariantTile } from "./tiles";
import type { Variant } from "./types";

type Who = Readonly<{ brandId: string; brandName: string; userId: string }>;

/** The design at one version, with the gate for its candidates and the variants it gives. */
async function variantsAt(client: SupabaseClient, who: Pick<Who, "brandId" | "brandName">, projectId: string, version?: number) {
  const reads = await readTechPack(client, who.brandId, projectId, version);
  const profile = await loadFactoryProfile(client);
  const gate = validationGate({ ...reads, brandName: who.brandName, now: new Date() }, profile);
  return { reads, variants: variantsFor(reads.project.spec, projectId, reads.project.currentVersion, gate) };
}

interface VariantList {
  readonly version: number;
  readonly tiles: readonly VariantTile[];
}

/** The alternatives for the current version of a design, drawn. */
export async function listVariants(client: SupabaseClient, who: Pick<Who, "brandId" | "brandName">, projectId: string): Promise<VariantList> {
  const { reads, variants } = await variantsAt(client, who, projectId);
  return { version: reads.project.currentVersion, tiles: variantTiles(variants, reads.charts) };
}

export interface Applied {
  readonly version: number;
  /** False when the design was already this variant and nothing new was saved. */
  readonly created: boolean;
}

/**
 * Applies one variant of version `expectedVersion` as a new version. The list is worked out again on the server from the
 * version, so the browser names a variant and never sends changes. Pressing twice makes one version.
 */
export async function applyVariant(
  deps: Readonly<{ client: SupabaseClient; admin: SupabaseClient }>,
  who: Who,
  input: Readonly<{ projectId: string; expectedVersion: number; variantId: string }>,
): Promise<Applied> {
  const { variants } = await variantsAt(deps.client, who, input.projectId, input.expectedVersion);
  const variant: Variant | undefined = findVariant(variants, input.variantId);
  if (!variant) throw new AppError("not_found", "That alternative is no longer offered. Open the panel again to see the current ones.");
  const current = (await readTechPack(deps.client, who.brandId, input.projectId)).project;
  const decision = decideApply({ expectedVersion: input.expectedVersion, currentVersion: current.currentVersion, variantSpec: variant.spec, currentSpec: current.spec });
  if (decision === "already") return { version: current.currentVersion, created: false };
  if (decision === "conflict") throw new AppError("conflict", "The design has changed since you opened this panel. Open it again to see the current alternatives.");
  const outcome = await saveTrustedActions(deps.admin, deps.client, {
    brandId: who.brandId,
    userId: who.userId,
    projectId: input.projectId,
    expectedVersion: input.expectedVersion,
    actions: variant.actions,
    source: "kit-style",
    explanations: [`${variant.label}. ${variant.summary}`],
  });
  if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);
  return { version: outcome.version, created: outcome.version !== input.expectedVersion };
}
