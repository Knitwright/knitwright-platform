import type { BoundsMm, PointMm } from "@/lib/artwork-stack/units";
import { mixHex } from "../colour";
import { defineGenerator } from "../define";
import { circle, polygon, rectangle } from "../geometry";
import type { GeneratorParam } from "../params";

const MODES = ["smooth", "round", "stepped"] as const;

const PARAMS: readonly GeneratorParam[] = [
  { id: "mode", label: "Kind of fade", unit: "none", min: 0, max: 2, step: 1, default: 0, choices: MODES },
  { id: "angle", label: "Direction", noun: "direction", unit: "degrees", min: 0, max: 360, step: 15, default: 90 },
  { id: "length", label: "Fade length", noun: "fade", unit: "mm", min: 100, max: 2000, step: 100, default: 600, words: { up: ["longer", "slower", "more gradual"], down: ["shorter", "quicker", "sharper"] } },
  { id: "steps", label: "Number of steps", noun: "number of steps", unit: "count", min: 4, max: 48, step: 4, default: 24, words: { up: ["smoother"], down: ["chunkier", "more stepped"] } },
];

/** The colour a fade has `t` of the way through (0 to 1), over two to four stops spread evenly. */
export function stopColour(stops: readonly string[], t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  if (stops.length === 1) return stops[0];
  const place = clamped * (stops.length - 1);
  const at = Math.min(stops.length - 2, Math.floor(place));
  return mixHex(stops[at], stops[at + 1], place - at);
}

/** How far the farthest corner of the bounds is from a point. */
const reachFrom = (bounds: BoundsMm, from: PointMm): number =>
  Math.max(...[bounds.minX, bounds.maxX].flatMap((x) => [bounds.minY, bounds.maxY].map((y) => Math.hypot(x - from.x, y - from.y)))) + 1;

/** A band across the direction of the fade, from `t0` to `t1` (mm from the datum along it). */
function band(datum: PointMm, angle: number, t0: number, t1: number, half: number, fill: string): ReturnType<typeof polygon> {
  const [ux, uy] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
  const [vx, vy] = [-uy, ux];
  const at = (t: number, s: number): PointMm => ({ x: datum.x + ux * t + vx * s, y: datum.y + uy * t + vy * s });
  return polygon([at(t0, -half), at(t1, -half), at(t1, half), at(t0, half)], fill, "Fade band");
}

/**
 * A fade from the datum: smooth or stepped along any angle, or round from the datum outwards. Two to four colours.
 * Drawn as many thin bands, so the print file stays vector; the colour at a point depends only on the point.
 */
export const gradient = defineGenerator({
  id: "gradient",
  label: "Colour fade",
  summary: "A fade between two to four colours, in a line or round.",
  aliases: ["gradient", "fade", "ombre"],
  params: PARAMS,
  maxColours: 4,
  period: (values) => ({ width: values.length / values.steps, height: values.length / values.steps }),
  draw({ context, values, inks }) {
    const { bounds, datum } = context;
    const stops = inks.length === 1 ? [inks[0], context.ground] : inks;
    const count = Math.round(values.steps);
    const reach = reachFrom(bounds, datum);
    const stepped = values.mode === 2;
    const colourOf = (k: number): string => stopColour(stops, stepped ? k / (count - 1) : (k + 0.5) / count);
    const [x0, y0, x1, y1] = [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
    if (values.mode === 1) {
      // Rings from the outside in. The outermost ring is the base, so it is not drawn twice.
      const rings = Array.from({ length: count - 1 }, (_, at) => count - 2 - at).map((k) => circle(datum, (values.length * (k + 1)) / count, colourOf(k), "Fade ring"));
      return { shapes: [rectangle(x0, y0, x1, y1, colourOf(count - 1), "Fade base"), ...rings] };
    }
    const bands = Array.from({ length: count }, (_, k) => {
      const [from, to] = [k === 0 ? -reach : (values.length * k) / count, k === count - 1 ? reach + values.length : (values.length * (k + 1)) / count];
      return band(datum, values.angle, from, to, reach + values.length, colourOf(k));
    });
    return { shapes: [rectangle(x0, y0, x1, y1, colourOf(0), "Fade base"), ...bands] };
  },
});
