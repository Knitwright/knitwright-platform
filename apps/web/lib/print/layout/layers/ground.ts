import type { GroundLayer } from "@/lib/artwork-stack";
import { screenColour } from "../colours";
import type { LayerResult, LayerSpace } from "../types";

/** A flat fill that runs out past the cut line into the bleed. */
export function groundLayer(layer: GroundLayer, space: LayerSpace): LayerResult {
  const { stack, colourwayId } = space.input;
  const colour = screenColour(stack, colourwayId, layer.colourId);
  const item = { kind: "fill", layerId: layer.id, rings: [space.visible], colour: colour.hex, opacity: layer.opacity, blend: layer.blend } as const;
  return { built: [{ item, kind: "ground" }], knock: [], issues: colour.issue ? [colour.issue] : [], colours: [colour.hex], dpis: [] };
}
