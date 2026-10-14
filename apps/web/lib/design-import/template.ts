import type { LandmarkId } from "@/lib/production/contract";
import type { ViewId } from "@/lib/artwork-stack";
import type { PointMm } from "@/lib/artwork-stack";

/**
 * Where the landmarks are on the template a picture is fitted to: the right half and the centre of one view,
 * in design millimetres (centre line x = 0, y runs down from the high point of the shoulder).
 */
export type TemplateLandmarks = Partial<Record<LandmarkId, PointMm>>;

/** Where the template for a view comes from. The pattern library supplies real ones; until then the starter below. */
export interface TemplateSource {
  templateFor(view: ViewId, size: string): TemplateLandmarks | null;
  /** Said in the report, so nobody mistakes a starter outline for their own pattern. */
  readonly description: string;
}

const FRONT: TemplateLandmarks = {
  hps: { x: 95, y: 0 },
  "shoulder-point": { x: 215, y: 28 },
  underarm: { x: 255, y: 235 },
  "cf-neck": { x: 0, y: 105 },
  "cf-hem": { x: 0, y: 700 },
  "side-hem": { x: 265, y: 700 },
};

const BACK: TemplateLandmarks = {
  ...FRONT,
  "shoulder-point": { x: 215, y: 24 },
  "cb-neck": { x: 0, y: 26 },
  "cb-hem": { x: 0, y: 700 },
};
delete (BACK as Record<string, unknown>)["cf-neck"];
delete (BACK as Record<string, unknown>)["cf-hem"];

/**
 * A starter outline of an adult crew-neck top at its drawn size. It is not a measured pattern and not any
 * brand's block: it is only a frame to place a picture on until a pattern block is attached (decision 0034).
 */
export const starterTemplate: TemplateSource = {
  description: "Fitted to a starter outline of a crew-neck top, because no pattern block is attached to this design yet.",
  templateFor: (view) => (view === "front" ? FRONT : view === "back" ? BACK : null),
};
