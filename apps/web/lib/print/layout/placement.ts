import type { Placement, PointMm, ViewId } from "@/lib/artwork-stack";
import { anchorPoint, zoneCentre, zoneRectangle, STANDARD_CLEAR_SPACE_MM } from "../zones";
import type { ZoneTemplate } from "../zones";
import type { BuildEnv } from "./context";

export interface ResolvedPlace {
  /** The middle of the thing, on the design plane, before the layer's own offset. */
  readonly centre: PointMm;
  readonly zone: ZoneTemplate | null;
  /** The zone's own width and height in millimetres, when there is a zone. */
  readonly zoneSize: { readonly widthMm: number; readonly heightMm: number } | null;
  readonly clearSpaceMm: number;
  /** True when the layer is on a free anchor rather than a standard zone. */
  readonly outsideStandardZones: boolean;
}

export interface PlaceProblem {
  readonly problem: string;
}

export const isProblem = (r: ResolvedPlace | PlaceProblem): r is PlaceProblem => "problem" in r;

/** The template for a zone name on a view: by id, else by purpose (a sleeve badge has one on each sleeve). */
export function templateFor(env: Pick<BuildEnv, "zoneTemplates">, view: ViewId, idOrPurpose: string): ZoneTemplate | undefined {
  const onView = env.zoneTemplates.filter((t) => t.view === view);
  return onView.find((t) => t.id === idOrPurpose) ?? onView.find((t) => t.purpose === idOrPurpose);
}

/** Where a placed layer goes: on a named zone, or on a named anchor (reported as outside the standard zones). */
export function resolvePlace(env: BuildEnv, view: ViewId, size: string, placement: Placement): ResolvedPlace | PlaceProblem {
  if (placement.kind === "zone") {
    const t = templateFor(env, view, placement.zoneId);
    const centre = t === undefined ? null : zoneCentre(env.mapper, t, size);
    const rect = t === undefined ? null : zoneRectangle(env.mapper, t, size);
    if (t === undefined || centre === null || rect === null) return { problem: `The zone "${placement.zoneId}" is not on the ${view.replace("-", " ")}, so this was not placed.` };
    return {
      centre,
      zone: t,
      zoneSize: { widthMm: rect[1].x - rect[0].x, heightMm: rect[2].y - rect[1].y },
      clearSpaceMm: t.clearSpaceMm,
      outsideStandardZones: false,
    };
  }
  const at = anchorPoint(env.mapper, view, placement.anchorId, size);
  if (at === null) return { problem: `The place "${placement.anchorId.replaceAll("-", " ")}" is not on the ${view.replace("-", " ")} of this pattern, so this was not placed.` };
  return { centre: at, zone: null, zoneSize: null, clearSpaceMm: STANDARD_CLEAR_SPACE_MM, outsideStandardZones: true };
}

export const OUTSIDE_ZONES_SENTENCE = (name: string): string => `${name} is outside the standard zones.`;
