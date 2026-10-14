import { isLandmarkOf, type PointMm, type ViewId } from "@/lib/artwork-stack";
import { LANDMARK_IDS, type LandmarkId } from "@/lib/production/contract";
import type { LayoutMapper } from "../layout/mapper";

/** The named places on the flat drawings (lib/flat/templates/anchors.ts), as shares of the same landmark distances, so a size follows by landmark. */
const BODY_ANCHORS: Readonly<Record<string, { readonly view: ViewId; readonly across: number; readonly down: number }>> = {
  "centre-chest": { view: "front", across: 0, down: 0.62 },
  "left-chest": { view: "front", across: 0.45, down: 0.55 },
  "right-chest": { view: "front", across: -0.45, down: 0.55 },
  "upper-back": { view: "back", across: 0, down: 0.45 },
  "centre-back": { view: "back", across: 0, down: 0.62 },
};

export interface BodyMeasures {
  /** Plane y of the shoulder line (negative: above the chest line). */
  readonly topY: number;
  /** Half of the chest, centre line to side seam, at the underarm. */
  readonly halfChest: number;
}

/** What the landmarks of a body view say about its depth and width in this size, or null when it lacks them. */
export function bodyMeasures(mapper: LayoutMapper, view: ViewId, size: string): BodyMeasures | null {
  const [hps, underarm] = [mapper.landmarkPlane(view, "hps", size), mapper.landmarkPlane(view, "underarm", size)];
  const frame = mapper.frame(view, size);
  if (hps === undefined || underarm === undefined || frame === null) return null;
  return { topY: hps.y - frame.wornOrigin[1], halfChest: Math.abs(underarm.x - frame.wornOrigin[0]) };
}

/** A point on a body view from shares of its depth (from the shoulder line down) and half chest (from the centre line). */
export function bodyPoint(mapper: LayoutMapper, view: ViewId, size: string, across: number, down: number): PointMm | null {
  const m = bodyMeasures(mapper, view, size);
  const f = mapper.frame(view, size);
  if (m === null || f === null) return null;
  return { x: f.wornOrigin[0] + across * m.halfChest, y: f.wornOrigin[1] + m.topY * (1 - down) };
}

/** The share of depth the named anchors of the flats use, converted to a point on the plane. Null for a name nothing knows. */
export function anchorPoint(mapper: LayoutMapper, view: ViewId, anchorId: string, size: string): PointMm | null {
  const named = BODY_ANCHORS[anchorId];
  if (named !== undefined && named.view === view) return bodyPoint(mapper, view, size, named.across, named.down);
  if (anchorId === "sleeve-centre" && (view === "sleeve-left" || view === "sleeve-right")) return sleevePoint(mapper, view, size, 0, 0.5);
  if ((LANDMARK_IDS as readonly string[]).includes(anchorId) && isLandmarkOf(view, anchorId)) {
    return mapper.landmarkPlane(view, anchorId as LandmarkId, size) ?? null;
  }
  return null;
}

/** A point on a sleeve view: `across` from its long axis in millimetres, `down` as a share of the cap height (cap top to underarm line). */
export function sleevePoint(mapper: LayoutMapper, view: ViewId, size: string, across: number, down: number): PointMm | null {
  const f = mapper.frame(view, size);
  const underarm = mapper.landmarkPlane(view, "underarm-a", size);
  if (f === null || underarm === undefined) return null;
  const cap = underarm.y - f.wornOrigin[1];
  return { x: f.wornOrigin[0] + across, y: f.wornOrigin[1] + cap * down };
}
