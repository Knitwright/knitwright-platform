import { describeStack, type ArtworkStack } from "@/lib/artwork-stack";
import { GENERATORS } from "@/lib/pattern-generators/registry";
import { printScale } from "@/lib/production/contract";
import type { ProductionInput } from "./input";
import { imageNote, imageRows, minDpiOf } from "./image-dpi";
import { layerPlacementRows, PLACEMENT_NOTE } from "./layer-placement";
import { pictureBlock } from "./picture-read";
import { dotsRepeatOf, repeatSpecRows } from "./repeat-spec";
import { layerRows } from "./stack-layers";
import type { ArtworkAndColourSection } from "./types";

export const NO_PLACEMENT_YET = "Placements are measured on the pattern once it is in the library and the print files have their zones.";

export type StackParts = Pick<
  ArtworkAndColourSection,
  "source" | "description" | "layers" | "layerPlacements" | "layerPlacementNote" | "repeatSpecs" | "images" | "imagesNote" | "picture"
>;

export interface StackSection {
  readonly parts: StackParts;
  /** The dots' sizes worked out from the stack, or null. */
  readonly dotsRepeat: ReturnType<typeof dotsRepeatOf>;
}

/** How much larger artwork is printed than drawn, across the garment. 1 when the fabric has no shrink test. */
const scaleOf = (input: ProductionInput): number => {
  const scale = input.fabric ? printScale(input.fabric) : null;
  return scale === null || scale.notScaled ? 1 : scale.width;
};

/**
 * What the artwork and colour page holds beyond the colour list when the design has an artwork stack: the design in
 * words, every layer, where each placed layer sits on every size, the repeat of each pattern or tile, the resolution of each
 * picture, and the report of a design read from a picture. A design with no stack gets the same fields, empty.
 */
export function stackParts(input: ProductionInput, stack: ArtworkStack | null, technique: string | null): StackSection {
  const min = minDpiOf(input);
  const scale = scaleOf(input);
  const picture = pictureBlock(stack, input.picture ?? null);
  if (stack === null) {
    const parts: StackParts = { source: "legacy", description: null, layers: [], layerPlacements: [], layerPlacementNote: NO_PLACEMENT_YET, repeatSpecs: [], images: [], imagesNote: imageNote(min, scale), picture };
    return { parts, dotsRepeat: null };
  }
  const layerPlacements = layerPlacementRows(stack, { pattern: input.pattern, zones: input.zones ?? [] });
  const parts: StackParts = {
    source: "stack",
    description: describeStack(stack, input.colourwayId, GENERATORS),
    layers: layerRows(stack, { technique, colourwayId: input.colourwayId }),
    layerPlacements,
    layerPlacementNote: layerPlacements.length === 0 ? NO_PLACEMENT_YET : PLACEMENT_NOTE,
    repeatSpecs: repeatSpecRows(stack, input.assets ?? []),
    images: imageRows(stack, { assets: input.assets ?? [], minDpi: min, scale, acceptances: input.lowDpiAcceptances ?? [], pattern: input.pattern }),
    imagesNote: imageNote(min, scale),
    picture,
  };
  return { parts, dotsRepeat: dotsRepeatOf(stack, input.colourwayId) };
}
