import type { Placement, PointMm } from "@/lib/artwork-stack";
import type { PrintZone } from "@/lib/production/contract";
import { apply, applyAll, type Affine } from "../geometry/affine";
import { ringWithin, turnedRect } from "../geometry/polygon";
import { NAMED_ANCHORS } from "../zones/templates";
import { findZone } from "../zones/build";
import type { PrintIssue, Ring } from "../scene";
import type { LayerSpace, PlacedMark } from "./types";

interface Placed {
  /** Where the mark's centre goes, in design space, before its own offset. */
  readonly centre: PointMm;
  readonly zone: PrintZone | null;
  readonly zonePolygon: Ring | null;
}

const NOT_KNOWN = (id: string): PrintIssue => ({ severity: "warn", text: `The place "${id}" is not one this garment has, so the mark was left off.` });

/** Where a placement names: the middle of a zone, or a named anchor. Null, with a sentence, when it names nothing. */
export function resolvePlacement(placement: Placement, space: LayerSpace): { placed: Placed } | { issue: PrintIssue } {
  const { input, toDesign, chestY } = space;
  const view = input.instance.view;
  if (placement.kind === "zone") {
    const zone = findZone(input.zones, placement.zoneId, view);
    const polygon = zone?.polygonBySize[input.instance.size];
    if (!zone || !polygon) return { issue: NOT_KNOWN(placement.zoneId) };
    const middle = apply(toDesign, [polygon.reduce((s, p) => s + p[0], 0) / polygon.length, polygon.reduce((s, p) => s + p[1], 0) / polygon.length]);
    return { placed: { centre: { x: middle[0], y: middle[1] }, zone, zonePolygon: polygon } };
  }
  const named = NAMED_ANCHORS[placement.anchorId];
  if (named && named.view === view) return { placed: { centre: { x: named.x, y: named.y + chestY }, zone: null, zonePolygon: null } };
  const landmark = input.anchors[placement.anchorId];
  if (landmark) return { placed: { centre: landmark, zone: null, zonePolygon: null } };
  return { issue: NOT_KNOWN(placement.anchorId) };
}

/** A turned rectangle placed in design space, as a ring on the piece. */
export function markRing(centre: PointMm, offset: PointMm, widthMm: number, heightMm: number, rotationDeg: number, toPiece: Affine): Ring {
  const design = turnedRect([centre.x + offset.x, centre.y + offset.y], widthMm, heightMm, (rotationDeg * Math.PI) / 180);
  return applyAll(toPiece, design);
}

/** Whether a mark sits inside the zone it was placed in, or, for a free anchor, inside any zone of the view. */
export function markReport(layerId: string, ring: Ring, placed: Placed, space: LayerSpace): { mark: PlacedMark; issues: PrintIssue[] } {
  const { input } = space;
  const view = input.instance.view;
  const size = input.instance.size;
  const within = (polygon: Ring | undefined): boolean => polygon !== undefined && ringWithin(ring, polygon);
  if (placed.zone && placed.zonePolygon) {
    const ok = within(placed.zonePolygon);
    return {
      mark: { layerId, ring, zoneId: placed.zone.id, inZone: ok },
      issues: ok ? [] : [{ severity: "warn", text: `The mark ${layerId} does not fit inside its place (${placed.zone.id}). Make it smaller or move it.` }],
    };
  }
  const inAny = input.zones.some((zone) => zone.pieceId === view && within(zone.polygonBySize[size]));
  return {
    mark: { layerId, ring, zoneId: null, inZone: inAny },
    issues: inAny ? [] : [{ severity: "note", text: `The mark ${layerId} is outside the standard places, so check where it sits.` }],
  };
}
