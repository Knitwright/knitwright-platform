import { FillRule, intersectD } from "clipper2-ts";
import type { PointMm, ViewId } from "@/lib/artwork-stack";
import type { PrintZone } from "@/lib/production/contract";
import { rect, type Pt } from "../geometry/vec";
import type { LayoutMapper } from "../layout/mapper";
import { bodyMeasures, bodyPoint, sleevePoint } from "./anchors";
import { ZONE_TEMPLATES, type ZoneTemplate } from "./templates";

/** The centre of a zone template on the plane for one size, or null when the view lacks the landmarks. */
export function zoneCentre(mapper: LayoutMapper, t: ZoneTemplate, size: string): PointMm | null {
  if (t.view === "front" || t.view === "back") return bodyPoint(mapper, t.view, size, t.across, t.down);
  if (t.view === "sleeve-left" || t.view === "sleeve-right") return t.band ? sleeveBandCentre(mapper, t, size) : sleevePoint(mapper, t.view, size, 0, t.down);
  return null;
}

/** A band sits at a distance from the cap top measured as a share of the band's own height, down to the hem. */
function sleeveBandCentre(mapper: LayoutMapper, t: ZoneTemplate, size: string): PointMm | null {
  const f = mapper.frame(t.view, size);
  const hem = mapper.landmarkPlane(t.view, "hem-a", size);
  if (f === null || hem === undefined) return null;
  return { x: f.wornOrigin[0], y: hem.y - t.heightMm * 0.5 - 10 };
}

/** The rectangle of a zone on the plane: centred on its point, upright. */
export function zoneRectangle(mapper: LayoutMapper, t: ZoneTemplate, size: string): readonly PointMm[] | null {
  const c = zoneCentre(mapper, t, size);
  const f = mapper.frame(t.view, size);
  if (c === null || f === null) return null;
  const half = t.band ? sleeveHalfWidth(mapper, t.view, size) : t.widthMm / 2;
  if (half === null) return null;
  return [
    { x: c.x - half, y: c.y - t.heightMm / 2 },
    { x: c.x + half, y: c.y - t.heightMm / 2 },
    { x: c.x + half, y: c.y + t.heightMm / 2 },
    { x: c.x - half, y: c.y + t.heightMm / 2 },
  ];
}

function sleeveHalfWidth(mapper: LayoutMapper, view: ViewId, size: string): number | null {
  const [a, b] = [mapper.landmarkPlane(view, "hem-a", size), mapper.landmarkPlane(view, "hem-b", size)];
  return a === undefined || b === undefined ? null : Math.abs(a.x - b.x) / 2 + 5;
}

function toPiece(mapper: LayoutMapper, t: ZoneTemplate, size: string): Pt[] | null {
  const plane = zoneRectangle(mapper, t, size);
  if (plane === null) return null;
  const points = plane.map((p) => mapper.planeToPiece(t.view, p, size));
  if (points.some((p) => p === null)) return null;
  const poly = points as Pt[];
  if (!t.band) return poly;
  // A band is cut to the sleeve's outline so it never runs outside the piece.
  const frame = mapper.frame(t.view, size)!;
  const cut = intersectD([poly.map(([x, y]) => ({ x, y }))], [frame.opened.outline.map(([x, y]) => ({ x, y }))], FillRule.NonZero, 2);
  const best = cut.reduce<(typeof cut)[number] | undefined>((a, c) => (a !== undefined && a.length >= c.length ? a : c), undefined);
  return best === undefined ? null : best.map((p): Pt => [p.x, p.y]);
}

/** Zones for every size of a pattern, in piece millimetres, as the contract states them. A zone whose view has no piece is left out. */
export function buildZones(mapper: LayoutMapper, sizes: readonly string[], templates: readonly ZoneTemplate[] = ZONE_TEMPLATES): PrintZone[] {
  const zones: PrintZone[] = [];
  for (const t of templates) {
    const polygonBySize: Record<string, Pt[]> = {};
    for (const size of sizes) {
      const poly = toPiece(mapper, t, size);
      if (poly !== null) polygonBySize[size] = poly;
    }
    const frame = sizes.length > 0 ? mapper.frame(t.view, sizes[0]) : null;
    if (frame === null || Object.keys(polygonBySize).length !== sizes.length) continue;
    zones.push({ id: t.id, pieceId: frame.pieceId, purpose: t.purpose, polygonBySize, clearSpaceMm: t.clearSpaceMm });
  }
  return zones;
}

export const zoneFor = (zones: readonly PrintZone[], idOrPurpose: string): PrintZone | undefined =>
  zones.find((z) => z.id === idOrPurpose) ?? zones.find((z) => z.purpose === idOrPurpose);

export { bodyMeasures, rect };
