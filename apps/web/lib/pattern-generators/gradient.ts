import type { DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { BoundsMm } from "@/lib/artwork-stack/units";
import { along, inksOf, numberParam, valuesOf } from "./common";
import { directionOf, dot, rotatePoint, rectPolygon } from "./geometry";
import { circleShape, clippedShape, listOf } from "./shapes";

/** Gradient and fade: linear or radial, smooth or in steps, any angle, 2 to 4 stops. The old fade is a preset. A field: it runs from the datum. */

export const GRADIENT_MODES = ["linear", "radial", "linear steps", "radial steps"] as const;
const SMOOTH_BANDS = 48;

export const GRADIENT_PARAMS = [
  numberParam({ id: "mode", label: "Kind", unit: "none", min: 0, max: 3, step: 1, default: 0, up: [], down: [] }),
  numberParam({ id: "angleDeg", label: "Direction", unit: "degrees", min: 0, max: 360, step: 15, default: 90, up: ["turn clockwise"], down: ["turn anticlockwise"] }),
  numberParam({ id: "lengthMm", label: "Length of the change", unit: "mm", min: 100, max: 1500, step: 100, default: 600, up: ["longer", "gentler", "softer"], down: ["shorter", "sharper", "quicker"] }),
  numberParam({ id: "stops", label: "Colours", unit: "count", min: 2, max: 4, step: 1, default: 2, up: ["more colours"], down: ["fewer colours"] }),
  numberParam({ id: "steps", label: "Steps", unit: "count", min: 2, max: 12, step: 1, default: 5, up: ["more steps"], down: ["fewer steps"] }),
] as const;

const bands = (mode: number, steps: number): number => (mode >= 2 ? Math.round(steps) : SMOOTH_BANDS);

/** The colour of band `k` of `n`. A stepped gradient takes the colour at the band's middle. */
const bandColour = (stops: readonly string[], k: number, n: number): string => along(stops, (k + 0.5) / n);

function linear(box: BoundsMm, datum: { x: number; y: number }, angle: number, length: number, stops: readonly string[], n: number): DisplayShape[] {
  const direction = directionOf(angle);
  const corners = rectPolygon(box).map((corner) => dot({ x: corner.x - datum.x, y: corner.y - datum.y }, direction));
  const [low, high] = [Math.min(...corners), Math.max(...corners)];
  const reach = high - low + length;
  const edge = (k: number): number => (k / n - 0.5) * length;
  const across = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) * 2 + length;
  const strip = (from: number, to: number, fill: string): DisplayShape[] => {
    const rectangle = [{ x: from, y: -across }, { x: to, y: -across }, { x: to, y: across }, { x: from, y: across }].map((point) =>
      rotatePoint({ x: datum.x + point.x, y: datum.y + point.y }, datum, angle),
    );
    return clippedShape(rectangle, box, fill);
  };
  const cuts = Array.from({ length: n + 1 }, (_, k) => edge(k));
  return [
    ...strip(low - reach, cuts[0] as number, stops[0] as string),
    ...cuts.slice(0, -1).flatMap((from, k) => (cuts[k + 1] as number) < low || from > high ? [] : strip(from, cuts[k + 1] as number, bandColour(stops, k, n))),
    ...strip(cuts[n] as number, high + reach, stops[stops.length - 1] as string),
  ];
}

function radial(box: BoundsMm, datum: { x: number; y: number }, length: number, stops: readonly string[], n: number): DisplayShape[] {
  const outer = clippedShape(rectPolygon(box), box, stops[stops.length - 1] as string);
  const rings = Array.from({ length: n }, (_, at) => n - 1 - at).map((k) => circleShape(datum, (length * (k + 1)) / n, bandColour(stops, k, n)));
  return [...outer, ...rings];
}

export const gradient: PatternGenerator = {
  id: "gradient",
  label: "Gradient",
  params: GRADIENT_PARAMS,
  repeat: { kind: "field" },
  maxColours: 4,
  render(context) {
    const values = valuesOf(GRADIENT_PARAMS, context.params);
    const stops = inksOf(context, Math.round(values.stops as number));
    const n = bands(Math.round(values.mode as number), values.steps as number);
    const mode = Math.round(values.mode as number);
    const [angle, length] = [values.angleDeg as number, values.lengthMm as number];
    const shapes = mode % 2 === 0 ? linear(context.bounds, context.datum, angle, length, stops, n) : radial(context.bounds, context.datum, length, stops, n);
    return listOf(shapes, false);
  },
};
