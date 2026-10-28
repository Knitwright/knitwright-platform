import type { GarmentSpec } from "@/lib/garment";
import { sameDesign } from "@/lib/projects/same-design";
import { generateVariants } from "./generate";
import { shortHash } from "./random";
import type { Variant, VariantGate } from "./types";

/** How many alternatives the panel shows. */
export const PANEL_COUNT = 10;

/** One seed for a design version, so the panel shows the same alternatives on every visit until the design changes. */
export const seedFor = (projectId: string, version: number): number => parseInt(shortHash(`${projectId}:${version}`), 16);

export const variantsFor = (spec: GarmentSpec, projectId: string, version: number, gate?: VariantGate): readonly Variant[] =>
  generateVariants(spec, { count: PANEL_COUNT, seed: seedFor(projectId, version), gate });

export const findVariant = (variants: readonly Variant[], id: string): Variant | undefined => variants.find((variant) => variant.id === id);

type ApplyDecision = "save" | "already" | "conflict";

/**
 * What to do with a press on a variant. A person looking at the current version saves it. A person one version
 * behind, whose design is now exactly the variant (a second press, or two tabs), is told it is done and no
 * second version is made. Anything else is a conflict.
 */
export function decideApply(input: Readonly<{ expectedVersion: number; currentVersion: number; variantSpec: GarmentSpec; currentSpec: GarmentSpec }>): ApplyDecision {
  if (input.expectedVersion === input.currentVersion) return "save";
  if (input.expectedVersion + 1 === input.currentVersion && sameDesign(input.variantSpec, input.currentSpec)) return "already";
  return "conflict";
}
