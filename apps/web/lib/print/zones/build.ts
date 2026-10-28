import type { ViewId } from "@/lib/artwork-stack";
import type { GradedPattern, PrintZone } from "@/lib/production/contract";
import { frameFor, type DesignAnchors } from "../frames/frame";
import { instancesOf, type PieceInstance, type PieceRoles } from "../frames/instances";
import { apply, type Pt } from "../geometry/affine";
import { round2 } from "../geometry/polygon";
import { JUNIOR_ZONE_SCALE, type ZoneBox, type ZoneTemplate } from "./templates";

interface ZoneOptions {
  /** Sizes whose marks are carried smaller. */
  readonly juniorSizes?: ReadonlySet<string>;
  readonly roles?: PieceRoles;
}

const sideOf = (view: ViewId): string => (view === "sleeve-left" ? "-left" : view === "sleeve-right" ? "-right" : "");
const zoneId = (template: ZoneTemplate, view: ViewId): string => (template.views.length > 1 ? `${template.id}${sideOf(view)}` : template.id);

function scaled(box: ZoneBox, by: number): ZoneBox {
  return { x0: box.x0 * by, y0: box.y0 * by, x1: box.x1 * by, y1: box.y1 * by };
}

/** The four corners of a zone box on a piece instance, in that piece's own millimetres (the opened piece). */
export function zonePolygon(instance: PieceInstance, anchors: DesignAnchors, box: ZoneBox): Pt[] {
  const { toPiece } = frameFor(instance, anchors);
  const chest = anchors[instance.view]?.underarm?.y ?? anchors[instance.view]?.["underarm-a"]?.y ?? 0;
  const corners: Pt[] = [
    [box.x0, box.y0 + chest],
    [box.x1, box.y0 + chest],
    [box.x1, box.y1 + chest],
    [box.x0, box.y1 + chest],
  ];
  return corners.map((corner) => {
    const [x, y] = apply(toPiece, corner);
    return [round2(x), round2(y)] as Pt;
  });
}

/** Every zone of a template on every piece, for every size, as the print contract holds them. */
export function buildZones(
  templates: readonly ZoneTemplate[],
  pattern: GradedPattern,
  anchors: DesignAnchors,
  options: ZoneOptions = {},
): PrintZone[] {
  const zones = new Map<string, PrintZone>();
  for (const size of pattern.sizes) {
    const { instances } = instancesOf(pattern.piecesBySize[size] ?? [], size, options.roles);
    const by = options.juniorSizes?.has(size) ? JUNIOR_ZONE_SCALE : 1;
    for (const template of templates) {
      for (const view of template.views) {
        const instance = instances.find((entry) => entry.view === view);
        if (!instance) continue;
        const id = zoneId(template, view);
        const polygon = zonePolygon(instance, anchors, scaled(template.box, by)).map(([x, y]): [number, number] => [x, y]);
        const known = zones.get(id);
        const polygonBySize = { ...(known?.polygonBySize ?? {}), [size]: polygon };
        zones.set(id, { id, pieceId: instance.id, purpose: template.purpose, polygonBySize, clearSpaceMm: template.clearSpaceMm });
      }
    }
  }
  return [...zones.values()];
}

/** The zone a layer names, for a view. A sleeve zone named without its side is the one on that view's sleeve. */
export function findZone(zones: readonly PrintZone[], wanted: string, view: ViewId): PrintZone | undefined {
  return zones.find((zone) => zone.id === wanted && zone.pieceId === view) ?? zones.find((zone) => zone.id === `${wanted}${sideOf(view)}` && zone.pieceId === view);
}
