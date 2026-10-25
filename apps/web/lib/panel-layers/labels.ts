import type { Layer, LayerKind } from "@/lib/artwork-stack";
import type { PanelFrame } from "./fabric-types";

export const KIND_LABELS: Readonly<Record<LayerKind, string>> = {
  ground: "Base colour",
  pattern: "Pattern",
  "image-fill": "Picture fill",
  graphic: "Artwork",
  text: "Text",
  "player-mark": "Name and number",
};

/** The name a person reads in the layer list. */
export function layerLabel(layer: Layer): string {
  if (layer.name !== undefined) return layer.name;
  if (layer.kind === "text") return `Text "${layer.text}"`;
  if (layer.kind === "player-mark") return `${KIND_LABELS[layer.kind]} (${layer.place})`;
  return KIND_LABELS[layer.kind];
}

/** The part of the plane shown: the panel and a margin. The canvas and the outline drawn under it share it. */
export function viewBoxOf(frame: PanelFrame, margin: number): { x: number; y: number; w: number; h: number } {
  return { x: frame.centre.x - frame.size.w / 2 - margin, y: frame.centre.y - frame.size.h / 2 - margin, w: frame.size.w + 2 * margin, h: frame.size.h + 2 * margin };
}
