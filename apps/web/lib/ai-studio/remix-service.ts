import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarmentSpec } from "@/lib/garment";
import { readTechPack } from "@/lib/projects/tech-pack-load";
import { saveTrustedActions } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { loadFactoryProfile } from "@/lib/validation/service";
import { decideApply } from "@/lib/variants/apply";
import { validationGate } from "@/lib/variants/gate";
import { variantTiles, type VariantTile } from "@/lib/variants/tiles";
import type { Variant, VariantGate } from "@/lib/variants/types";

/**
 * The server half of Retro kit remix and Change kit colour (decision 0141), on the same footing as
 * the editor's alternatives (`lib/variants/service.ts`): the design is read with the member's own
 * client, every candidate passes the factory validation gate, and applying one works the list out
 * again from the version and the answers, so the browser names a variant and never sends changes.
 */

type Who = Readonly<{ brandId: string; brandName: string; userId: string }>;

/** Makes the variants of one design version, given its spec and the gate. */
export type VariantMaker = (spec: GarmentSpec, gate: VariantGate) => readonly Variant[];

export interface MadeVariants {
  readonly version: number;
  readonly tiles: readonly VariantTile[];
}

async function variantsAt(client: SupabaseClient, who: Pick<Who, "brandId" | "brandName">, projectId: string, make: VariantMaker, version?: number) {
  const reads = await readTechPack(client, who.brandId, projectId, version);
  const profile = await loadFactoryProfile(client);
  const gate = validationGate({ ...reads, brandName: who.brandName, now: new Date() }, profile);
  return { reads, variants: make(reads.project.spec, gate) };
}

/** The variants of the current version of a design, drawn as flats. */
export async function makeVariants(client: SupabaseClient, who: Pick<Who, "brandId" | "brandName">, projectId: string, make: VariantMaker): Promise<MadeVariants> {
  const { reads, variants } = await variantsAt(client, who, projectId, make);
  return { version: reads.project.currentVersion, tiles: variantTiles(variants, reads.charts) };
}

/** Saves one variant as a new version of the design. Pressing twice makes one version. */
export async function saveVariant(
  deps: Readonly<{ client: SupabaseClient; admin: SupabaseClient }>,
  who: Who,
  input: Readonly<{ projectId: string; expectedVersion: number; variantId: string; make: VariantMaker; source: string }>,
): Promise<number> {
  const { variants } = await variantsAt(deps.client, who, input.projectId, input.make, input.expectedVersion);
  const variant = variants.find((one) => one.id === input.variantId);
  if (!variant) throw new AppError("not_found", "That variant is no longer offered. Generate again to see the current ones.");
  const current = (await readTechPack(deps.client, who.brandId, input.projectId)).project;
  const decision = decideApply({ expectedVersion: input.expectedVersion, currentVersion: current.currentVersion, variantSpec: variant.spec, currentSpec: current.spec });
  if (decision === "already") return current.currentVersion;
  if (decision === "conflict") throw new AppError("conflict", "The design has changed since these variants were made. Generate again.");
  const outcome = await saveTrustedActions(deps.admin, deps.client, {
    brandId: who.brandId,
    userId: who.userId,
    projectId: input.projectId,
    expectedVersion: input.expectedVersion,
    actions: variant.actions,
    source: "kit-style",
    explanations: [`${input.source}: ${variant.label}. ${variant.summary}`],
  });
  if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);
  return outcome.version;
}
