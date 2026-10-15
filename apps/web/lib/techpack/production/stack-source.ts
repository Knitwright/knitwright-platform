import { currentStack, type ArtworkStack } from "@/lib/artwork-stack";
import type { GarmentSpec } from "@/lib/garment";
import type { ProductionInput } from "./input";

/**
 * The artwork stack the document is built from: the one the production input carries, else the design's own.
 * A design that has no stack gives null, and only then does the document fall back to the older fields.
 * A stored stack that the older fields have moved away from is read the way `currentStack` reads it.
 */
export function stackOf(spec: GarmentSpec, production: Pick<ProductionInput, "stack">): ArtworkStack | null {
  if (production.stack) return production.stack;
  return spec.artworkStack === undefined ? null : currentStack(spec);
}
