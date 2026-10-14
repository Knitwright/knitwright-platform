import { z } from "zod";

export const BLENDS = ["normal", "multiply", "screen", "overlay", "knock-out"] as const;
export const blendSchema = z.enum(BLENDS);
export type Blend = z.output<typeof blendSchema>;

/** Multiply, screen and overlay mix pixels, so a piece that uses one is printed as a raster. Normal and knock-out stay vector. */
export const RASTER_BLENDS: readonly Blend[] = ["multiply", "screen", "overlay"];
export const blendNeedsRaster = (blend: Blend): boolean => RASTER_BLENDS.includes(blend);

export const LAYER_KINDS = ["ground", "pattern", "image-fill", "graphic", "text", "player-mark"] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];

/** Bottom to top by default. The order of the array is the blend order; this is the order a new layer starts in. */
export const DEFAULT_KIND_RANK: Readonly<Record<LayerKind, number>> = {
  ground: 0,
  pattern: 1,
  "image-fill": 2,
  graphic: 3,
  text: 4,
  "player-mark": 5,
};

/** A copy of the layers with each kind in its default place. Layers of one kind keep the order they had. */
export function inDefaultOrder<T extends { readonly kind: LayerKind }>(layers: readonly T[]): T[] {
  return layers
    .map((layer, at) => ({ layer, at }))
    .sort((a, b) => DEFAULT_KIND_RANK[a.layer.kind] - DEFAULT_KIND_RANK[b.layer.kind] || a.at - b.at)
    .map((entry) => entry.layer);
}

interface Ordered {
  readonly id: string;
  readonly kind: LayerKind;
  readonly blend: Blend;
  readonly views: readonly string[];
}

/** Plain sentences about blend order that make a stack meaningless: a blend with nothing under it, a ground that hides what is below. */
export function blendProblems(layers: readonly Ordered[]): string[] {
  return layers.flatMap((layer, at) => {
    const below = layers.slice(0, at).filter((other) => other.views.some((view) => layer.views.includes(view)));
    const found: string[] = [];
    if (layer.blend !== "normal" && layer.kind === "ground") found.push(`The ground (${layer.id}) must use the normal blend, because nothing lies under it.`);
    else if (layer.blend !== "normal" && below.length === 0) found.push(`Layer ${layer.id} blends with what is under it, and nothing is.`);
    if (layer.kind === "ground" && below.some((other) => other.kind !== "ground")) found.push(`The ground (${layer.id}) would cover the layers under it.`);
    return found;
  });
}
