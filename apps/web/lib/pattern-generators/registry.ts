import type { PatternGenerator } from "@/lib/artwork-stack/generator";
import { ADAPTER_GENERATORS } from "./adapters";
import { withBoundsCheck } from "./bounds";
import type { LibraryGenerator, Tile } from "./define";
import { brush } from "./generators/brush";
import { camo } from "./generators/camo";
import { checks, gingham, houndstooth } from "./generators/checks";
import { geometric } from "./generators/geometric";
import { gradient } from "./generators/gradient";
import { halftone } from "./generators/halftone";
import { stripeVariations } from "./generators/stripe-variations";
import { resolveParams, type Values } from "./params";

/** The new procedural styles. */
export const NEW_GENERATORS: readonly LibraryGenerator[] = [camo, geometric, gradient, halftone, checks, gingham, houndstooth, brush, stripeVariations].map(withBoundsCheck);

/** Every style the platform can draw: the eight that existed, then the new ones. Ids are unique. */
export const GENERATORS: readonly PatternGenerator[] = [...ADAPTER_GENERATORS, ...NEW_GENERATORS];

export const getGenerator = (id: string): PatternGenerator | undefined => GENERATORS.find((entry) => entry.id === id);

/** The library's own generators have more to say (words, picks, tiles). */
export const getLibraryGenerator = (id: string): LibraryGenerator | undefined => NEW_GENERATORS.find((entry) => entry.id === id);

/** The size of one repeat at these settings, or null for a field (a field has no tile). */
export function tileSizeFor(id: string, params: Readonly<Record<string, number | string | boolean>> = {}): Tile | null {
  const generator = getLibraryGenerator(id);
  if (generator?.tileFor === undefined) {
    const declared = getGenerator(id)?.repeat;
    return declared?.kind === "tile" ? { width: declared.tileMm.width, height: declared.tileMm.height } : null;
  }
  return generator.tileFor(resolveParams(generator.params, params) as Values);
}
