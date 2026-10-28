import type { ZONE_PURPOSES } from "@/lib/production/contract";
import type { ViewId } from "@/lib/artwork-stack";

/**
 * Where marks may go on a top, in design space: x from the centre line (right is positive, the wearer's left on the
 * front), y from the chest line (down is positive). Boxes follow the landmarks of each size, so they move with it.
 * These sizes are Knitwright defaults for a football jersey, not a competition's rules; a league rule set can narrow them.
 */
export interface ZoneBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface ZoneTemplate {
  /** The zone's id. A sleeve zone is named once here and gets "-left" or "-right" per sleeve. */
  readonly id: string;
  readonly purpose: (typeof ZONE_PURPOSES)[number];
  readonly views: readonly ViewId[];
  readonly box: ZoneBox;
  /** Clear space kept round a mark in the zone, in millimetres. */
  readonly clearSpaceMm: number;
}

const CLEAR_SPACE_MM = 10;

export const JERSEY_ZONES: readonly ZoneTemplate[] = [
  { id: "crest", purpose: "crest", views: ["front"], box: { x0: 70, y0: -135, x1: 150, y1: -60 }, clearSpaceMm: CLEAR_SPACE_MM },
  { id: "sponsor", purpose: "sponsor", views: ["front"], box: { x0: -150, y0: -40, x1: 150, y1: 30 }, clearSpaceMm: CLEAR_SPACE_MM },
  { id: "front-number", purpose: "front-number", views: ["front"], box: { x0: -75, y0: 45, x1: 75, y1: 165 }, clearSpaceMm: CLEAR_SPACE_MM },
  { id: "back-name", purpose: "back-name", views: ["back"], box: { x0: -170, y0: -150, x1: 170, y1: -85 }, clearSpaceMm: CLEAR_SPACE_MM },
  { id: "back-number", purpose: "back-number", views: ["back"], box: { x0: -125, y0: -70, x1: 125, y1: 200 }, clearSpaceMm: CLEAR_SPACE_MM },
  { id: "sleeve-badge", purpose: "sleeve-badge", views: ["sleeve-left", "sleeve-right"], box: { x0: -35, y0: -100, x1: 35, y1: -35 }, clearSpaceMm: CLEAR_SPACE_MM },
  { id: "sleeve-band", purpose: "sleeve-band", views: ["sleeve-left", "sleeve-right"], box: { x0: -150, y0: 15, x1: 150, y1: 55 }, clearSpaceMm: 0 },
];

/** Junior sizes carry marks smaller, by this share. A setting, not a measurement. */
export const JUNIOR_ZONE_SCALE = 0.8;

/** The templates for a kind of garment. Only tops have zones so far. */
export function zoneTemplatesFor(garment: string): readonly ZoneTemplate[] {
  return /jersey|tee|shirt|top|polo/.test(garment) ? JERSEY_ZONES : [];
}

/** Named anchors a placed mark can use, as a design-space point on a view (chest line = 0). */
export const NAMED_ANCHORS: Readonly<Partial<Record<string, { readonly view: ViewId; readonly x: number; readonly y: number }>>> = {
  "left-chest": { view: "front", x: 110, y: -97 },
  "centre-chest": { view: "front", x: 0, y: -5 },
  "upper-back": { view: "back", x: 0, y: -117 },
  "centre-back": { view: "back", x: 0, y: 65 },
};
