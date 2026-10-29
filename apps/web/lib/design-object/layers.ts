import type { ArtworkStack, Layer, Placement, PlayerMarkLayer } from "@/lib/artwork-stack";
import type { DoAsset, DoLayer, DoZone } from "./types";

type Roles = ReadonlyMap<string, string>;

const role = (roles: Roles, id: string | undefined): Record<string, string> => {
  const found = id === undefined ? undefined : roles.get(id);
  return found === undefined ? {} : { colour_role: found };
};

const anchorOf = (placement: Placement): string => (placement.kind === "zone" ? placement.zoneId : placement.anchorId);

/** The id an asset is exported under: an uploaded asset keeps its id, an older logo file is named by its file id. */
export const assetIdOf = (layer: Layer): string | null => {
  if (layer.kind === "image-fill") return layer.assetId;
  if (layer.kind === "graphic") return layer.source.kind === "asset" ? layer.source.assetId : `file-${layer.source.fileId}`;
  return null;
};

/** One stack layer as a spec layer. Player marks are not layers in the spec; they are name and number zones. */
export function layerOf(layer: Layer, roles: Roles): DoLayer | null {
  switch (layer.kind) {
    case "ground":
      return { type: "fill", ...role(roles, layer.colourId) };
    case "pattern":
      return { type: "pattern", pattern_id: layer.generatorId, colours: layer.colourIds.map((id) => roles.get(id) ?? id) };
    case "image-fill":
      return { type: "artwork", asset_id: layer.assetId, scale: layer.scale, rotation_deg: layer.rotationDeg, x_mm: layer.offsetMm.x, y_mm: layer.offsetMm.y, scale_by_size: "grade" };
    case "graphic":
      return {
        type: "artwork",
        asset_id: assetIdOf(layer) ?? layer.id,
        x_mm: layer.offsetMm.x,
        y_mm: layer.offsetMm.y,
        width_mm: layer.widthMm,
        rotation_deg: layer.rotationDeg,
        scale_by_size: "anchor",
        anchor: anchorOf(layer.placement),
      };
    case "text":
      return {
        type: "text",
        text: layer.text,
        ...(layer.lettering === undefined ? {} : { font_id: layer.lettering }),
        ...role(roles, layer.colourId),
        x_mm: layer.offsetMm.x,
        y_mm: layer.offsetMm.y,
        ...(layer.widthMm === undefined ? {} : { width_mm: layer.widthMm }),
        rotation_deg: layer.rotationDeg,
        scale_by_size: "anchor",
        anchor: anchorOf(layer.placement),
      };
    case "player-mark":
      return null;
  }
}

/** The panels of the spec: one per view of the stack, each with its layers bottom to top. */
export function panelsOf(stack: ArtworkStack, roles: Roles): readonly { panel_id: string; layers: readonly DoLayer[] }[] {
  return stack.views.map((view) => ({
    panel_id: view,
    layers: stack.layers.filter((layer) => layer.views.includes(view)).flatMap((layer) => layerOf(layer, roles) ?? []),
  }));
}

/** Every asset the stack places, once each in id order, with its moderation result or `pending` when none is known. */
export function assetsOf(stack: ArtworkStack, moderation: ReadonlyMap<string, DoAsset["moderation"]>): readonly DoAsset[] {
  const byId = new Map<string, DoAsset>();
  for (const layer of stack.layers) {
    const id = assetIdOf(layer);
    if (id === null || byId.has(id)) continue;
    const source = layer.kind === "graphic" && layer.source.kind === "file" ? layer.source.fileId : id;
    byId.set(id, { asset_id: id, kind: "artwork", file_key: layer.kind === "graphic" && layer.source.kind === "file" ? `file:${source}` : `asset:${source}`, moderation: moderation.get(source) ?? "pending" });
  }
  return [...byId.values()].sort((a, b) => a.asset_id.localeCompare(b.asset_id));
}

const ZONE_KIND: Readonly<Record<PlayerMarkLayer["place"], DoZone["kind"]>> = {
  "back-name": "name",
  "back-number": "number",
  "front-number": "front_number",
  "leg-number": "number",
};

/** Player name and number zones, one per mark and view. */
export function zonesOf(stack: ArtworkStack): readonly DoZone[] {
  return stack.layers.flatMap((layer) =>
    layer.kind !== "player-mark"
      ? []
      : layer.views.map((view) => ({ panel_id: view, kind: ZONE_KIND[layer.place], ...(layer.heightMm === undefined ? {} : { height_mm: layer.heightMm }) })),
  );
}

export const marksOf = (stack: ArtworkStack): readonly PlayerMarkLayer[] => stack.layers.filter((layer): layer is PlayerMarkLayer => layer.kind === "player-mark");
