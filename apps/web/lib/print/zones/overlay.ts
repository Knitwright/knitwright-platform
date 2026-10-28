import type { GradedPattern } from "@/lib/production/contract";
import { anchorsFromInstances, frameFor } from "../frames/frame";
import { instancesOf } from "../frames/instances";
import { applyAll } from "../geometry/affine";
import { round2 } from "../geometry/polygon";
import type { Ring } from "../scene";
import { JERSEY_ZONES, type ZoneTemplate } from "./templates";

/** Plain names for the places, as a club would say them. */
const ZONE_LABELS: Readonly<Record<string, string>> = {
  crest: "Crest",
  sponsor: "Sponsor",
  "front-number": "Number on the front",
  "back-name": "Name",
  "back-number": "Number on the back",
  "sleeve-badge": "Sleeve badge",
  "sleeve-band": "Sleeve band",
};

export interface OverlayZone {
  readonly id: string;
  readonly label: string;
  readonly ring: Ring;
  readonly clearSpaceMm: number;
}

export interface OverlayView {
  readonly id: string;
  readonly label: string;
  readonly outline: Ring;
  readonly zones: readonly OverlayZone[];
}

const VIEW_LABELS: Readonly<Record<string, string>> = { front: "Front", back: "Back", "sleeve-left": "Sleeve" };

/**
 * What the zone picture draws, in design millimetres with y down (as an SVG wants it): the shape of the front, back
 * and one sleeve at one size, and the standard places on them.
 */
export function overlayModel(pattern: GradedPattern, size: string = pattern.sizes[0] ?? "", templates: readonly ZoneTemplate[] = JERSEY_ZONES): OverlayView[] {
  const { instances } = instancesOf(pattern.piecesBySize[size] ?? [], size);
  const anchors = anchorsFromInstances(instances);
  return instances
    .filter((instance) => instance.id in VIEW_LABELS)
    .map((instance) => {
      const { toDesign } = frameFor(instance, anchors);
      const chest = anchors[instance.view]?.underarm?.y ?? anchors[instance.view]?.["underarm-a"]?.y ?? 0;
      const zones = templates
        .filter((template) => template.views.includes(instance.view))
        .map((template): OverlayZone => {
          const { x0, y0, x1, y1 } = template.box;
          const ring: Ring = [[x0, y0 + chest], [x1, y0 + chest], [x1, y1 + chest], [x0, y1 + chest]];
          return { id: template.id, label: ZONE_LABELS[template.id] ?? template.id, ring, clearSpaceMm: template.clearSpaceMm };
        });
      const outline = applyAll(toDesign, instance.opened).map(([x, y]): [number, number] => [round2(x), round2(y)]);
      return { id: instance.id, label: VIEW_LABELS[instance.id] as string, outline, zones };
    });
}
