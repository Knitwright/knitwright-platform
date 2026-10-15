import type { ArtworkStack, Layer, PointMm, ViewId } from "@/lib/artwork-stack";
import { formatCm } from "@/lib/garment";
import type { GradedPattern, PrintZone } from "@/lib/production/contract";
import { createPieceMapper, type PrintMapper } from "@/lib/print/layout/mapper";
import { apply } from "@/lib/print/geometry/affine";
import { findZone } from "@/lib/print/zones/build";
import { NAMED_ANCHORS } from "@/lib/print/zones/templates";
import { TBC, type LengthValue } from "../cell";
import { referenceOf } from "./placement";
import type { LayerPlacementRow } from "./types-art";

export const PLACEMENT_NOTE =
  "Measured on the pattern through the same fit the print files use, from the high point of shoulder (or the top of the sleeve cap) and from the centre line. The middle of each placed layer is measured, with its own offset added.";

type Placed = Extract<Layer, { kind: "graphic" | "text" | "player-mark" }>;

const isPlaced = (layer: Layer): layer is Placed => layer.kind === "graphic" || layer.kind === "text" || layer.kind === "player-mark";

const length = (mm: number): LengthValue => ({ status: "set", value: formatCm(Math.round(mm * 10)), tenthsMm: Math.round(mm * 10), provenance: "measured-from-pattern" });

/** The middle of the layer's place in design space on one size, or null when the place is not one this garment has. */
function centreOf(layer: Placed, view: ViewId, size: string, mapper: PrintMapper, zones: readonly PrintZone[]): PointMm | null {
  const zoneId = layer.kind === "player-mark" ? layer.place : layer.placement.kind === "zone" ? layer.placement.zoneId : null;
  if (zoneId !== null) {
    const polygon = findZone(zones, zoneId, view)?.polygonBySize[size];
    const frame = mapper.placed(size).find((entry) => entry.instance.view === view)?.frame;
    if (!polygon || !frame) return null;
    const [x, y] = apply(frame.toDesign, [polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length, polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length]);
    return { x, y };
  }
  if (layer.kind === "player-mark" || layer.placement.kind !== "anchor") return null;
  const named = NAMED_ANCHORS[layer.placement.anchorId];
  if (named && named.view === view) return { x: named.x, y: named.y + (mapper.anchors[view]?.underarm?.y ?? 0) };
  return mapper.anchors[view]?.[layer.placement.anchorId as keyof NonNullable<(typeof mapper.anchors)[ViewId]>] ?? null;
}

const offsetOf = (layer: Placed): PointMm => (layer.kind === "player-mark" ? { x: 0, y: 0 } : layer.offsetMm);

function rowFor(layer: Placed, view: ViewId, size: string, mapper: PrintMapper, zones: readonly PrintZone[]): LayerPlacementRow {
  const instance = mapper.placed(size).find((entry) => entry.instance.view === view)?.instance;
  const head = { layerId: layer.id, layer: layer.name ?? layer.id, size, view: view.replaceAll("-", " "), pieceName: instance?.pieceName ?? view };
  const centre = centreOf(layer, view, size, mapper, zones);
  const offset = offsetOf(layer);
  const hit = centre === null ? null : mapper.toPiece(view, { x: centre.x + offset.x, y: centre.y + offset.y }, size);
  const reference = hit === null || instance === undefined ? null : referenceOf(instance.piece);
  if (hit === null || reference === null) return { ...head, down: TBC, across: TBC };
  return { ...head, down: length(reference.top - hit.xMm), across: length(Math.abs(hit.yMm - reference.centre)) };
}

/**
 * For every layer that is placed (a picture, text or a player mark) and every size of the pattern: how far down from the high
 * point of shoulder and how far across from the centre line its middle lies, measured on the pattern through W3's mapper.
 */
export function layerPlacementRows(
  stack: ArtworkStack,
  input: { readonly pattern: GradedPattern | null | undefined; readonly zones: readonly PrintZone[] },
): LayerPlacementRow[] {
  if (!input.pattern) return [];
  const mapper = createPieceMapper(input.pattern);
  return stack.layers.filter(isPlaced).flatMap((layer) =>
    layer.views.flatMap((view) => input.pattern!.sizes.map((size) => rowFor(layer, view, size, mapper, input.zones))),
  );
}
