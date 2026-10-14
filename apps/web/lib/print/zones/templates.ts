import type { ViewId } from "@/lib/artwork-stack";
import type { PrintZone } from "@/lib/production/contract";

type ZonePurpose = PrintZone["purpose"];

/** Where a zone's sizes and places come from. They are settings, not measurements, and not rules (open items P5, P7). */
export const ZONE_DEFAULT_SOURCE = "Knitwright default zone, not from your league or print house";
export const SPONSOR_SOURCE = "Jersey template: sponsor at most 30 x 7 cm (plans/production-outputs.md, W3)";

/** The standard space kept clear around a mark, in millimetres: the benchmark's 1.0 cm. */
export const STANDARD_CLEAR_SPACE_MM = 10;

/**
 * A zone against the landmarks of its view, so it follows every size.
 * - `across`: how far from the centre line, as a share of the half chest (a body) or 0 (a sleeve), toward the
 *   viewer's right. For a body, 1 is the side seam at the underarm.
 * - `down`: how far down from the shoulder line (the neck-side point of the shoulder, HPS) toward the chest line,
 *   as a share of that depth. 1 is the chest line; more than 1 is below it.
 * - A sleeve is measured from the cap top toward the underarm line: `down` is a share of the cap height.
 */
export interface ZoneTemplate {
  readonly id: string;
  readonly purpose: ZonePurpose;
  readonly view: ViewId;
  readonly across: number;
  readonly down: number;
  readonly widthMm: number;
  readonly heightMm: number;
  /** A band takes the whole width of the piece at its height, cut to the outline. */
  readonly band?: boolean;
  readonly clearSpaceMm: number;
  readonly source: string;
}

const zone = (z: Omit<ZoneTemplate, "clearSpaceMm" | "source"> & { source?: string }): ZoneTemplate => ({
  clearSpaceMm: STANDARD_CLEAR_SPACE_MM,
  source: ZONE_DEFAULT_SOURCE,
  ...z,
});

/** The zones of the jersey template. A garment with other pieces adds its own list. */
export const ZONE_TEMPLATES: readonly ZoneTemplate[] = [
  zone({ id: "crest", purpose: "crest", view: "front", across: 0.48, down: 0.55, widthMm: 90, heightMm: 90 }),
  zone({ id: "sponsor", purpose: "sponsor", view: "front", across: 0, down: 0.95, widthMm: 300, heightMm: 70, source: SPONSOR_SOURCE }),
  zone({ id: "front-number", purpose: "front-number", view: "front", across: 0, down: 1.45, widthMm: 160, heightMm: 120 }),
  zone({ id: "back-name", purpose: "back-name", view: "back", across: 0, down: 0.3, widthMm: 320, heightMm: 60 }),
  zone({ id: "back-number", purpose: "back-number", view: "back", across: 0, down: 1.28, widthMm: 300, heightMm: 300 }),
  zone({ id: "sleeve-badge-left", purpose: "sleeve-badge", view: "sleeve-left", across: 0, down: 0.5, widthMm: 80, heightMm: 80 }),
  zone({ id: "sleeve-badge-right", purpose: "sleeve-badge", view: "sleeve-right", across: 0, down: 0.5, widthMm: 80, heightMm: 80 }),
  zone({ id: "sleeve-band-left", purpose: "sleeve-band", view: "sleeve-left", across: 0, down: 3.2, widthMm: 0, heightMm: 60, band: true }),
  zone({ id: "sleeve-band-right", purpose: "sleeve-band", view: "sleeve-right", across: 0, down: 3.2, widthMm: 0, heightMm: 60, band: true }),
];
