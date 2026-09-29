import type { GarmentSpec, PointOfMeasure, ResolvedType } from "@/lib/garment";
import { chain, lineTo, openCommands, pt } from "../chain";
import { CALLOUT_COLOUR } from "../colour";
import { formatCm } from "@/lib/garment";
import type { ResolvedDimensions } from "../dimensions";
import type { FlatElement, FlatModel, Point, View } from "../model";

/**
 * What every family's drawing code is given, and what it gives back. The tops code keeps its
 * own path in `build.ts`. The other families draw through this, so `buildFlat` can put any
 * family's drawing into the same model with the same layers.
 */
export interface DrawContext {
  readonly spec: GarmentSpec;
  readonly type: ResolvedType;
  readonly view: View;
  /** The points of measure that apply to the design. */
  readonly points: readonly PointOfMeasure[];
  /** Measurements that are present, in tenths of a millimetre. */
  readonly values: ReadonlyMap<string, number>;
  readonly wanted: (panelId: string) => boolean;
  readonly nameOf: (panelId: string) => string;
  readonly fillOf: (panelId: string) => string;
  /** True when callouts were asked for. They are added only to a drawing that is to scale. */
  readonly callouts: boolean;
}

export interface FamilyDrawing {
  readonly resolved: ResolvedDimensions;
  readonly panels: readonly FlatElement[];
  readonly seams: readonly FlatElement[];
  readonly stitching: readonly FlatElement[];
  readonly details: readonly FlatElement[];
  readonly artwork: readonly FlatElement[];
  readonly callouts: readonly FlatElement[] | null;
  readonly outline: FlatModel["outline"];
  readonly landmarks: FlatModel["landmarks"];
}

export type FamilyDrawer = (context: DrawContext) => FamilyDrawing | null;

/** The choice made for an option, or undefined when the design has none. */
export const chosen = (spec: Pick<GarmentSpec, "options">, optionId: string): string | undefined =>
  Object.hasOwn(spec.options, optionId) ? spec.options[optionId]?.choiceId : undefined;

const LABEL_SIZE = 50;
const LABEL_GAP = 30;
const LINE_WIDTH = 3;

export type Ends = readonly [Point, Point];

/**
 * A line and a label for each point of measure this view shows, with its value in
 * centimetres. Only asked for when the drawing is to scale.
 */
export function calloutsFrom(
  points: readonly PointOfMeasure[],
  value: (id: string) => number,
  endsFor: (id: string) => Ends | null,
): readonly FlatElement[] {
  return points.flatMap((point): FlatElement[] => {
    const ends = endsFor(point.id);
    if (!ends) return [];
    const [from, to] = ends;
    const middle = pt((from.x + to.x) / 2, (from.y + to.y) / 2);
    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
    return [
      {
        kind: "path",
        name: `${point.label} line`,
        panelId: null,
        commands: openCommands(chain(from, lineTo(to))),
        fill: null,
        stroke: { colour: CALLOUT_COLOUR, width: LINE_WIDTH, dash: [] },
      },
      {
        kind: "text",
        text: `${point.label} ${formatCm(value(point.id))} cm`,
        at: horizontal ? pt(middle.x, middle.y - LABEL_GAP) : pt(middle.x - LABEL_GAP, middle.y),
        size: LABEL_SIZE,
        anchor: horizontal ? "middle" : "end",
        colour: CALLOUT_COLOUR,
        rotation: 0,
      },
    ];
  });
}
