import type { DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import { inksOf, numberParam, valuesOf } from "./common";
import { directionOf, dot, rectPolygon, rotatePoint } from "./geometry";
import { makeRng } from "./rng";
import { clippedShape, listOf } from "./shapes";

/** Stripe variations: graduated widths, double stripes, an irregular rhythm, at any angle. A field: bands hang from the datum, and the rhythm repeats every cycle. */

export const STRIPE_RHYTHMS = ["even", "graduated", "double", "irregular"] as const;

export const STRIPE_RHYTHM_PARAMS = [
  numberParam({ id: "rhythm", label: "Rhythm", unit: "none", min: 0, max: 3, step: 1, default: 1, up: [], down: [] }),
  numberParam({ id: "widthMm", label: "Stripe width", unit: "mm", min: 2, max: 120, step: 4, default: 30, up: ["wider", "bolder", "thicker"], down: ["narrower", "finer", "thinner"] }),
  numberParam({ id: "gapMm", label: "Space between", unit: "mm", min: 2, max: 200, step: 4, default: 30, up: ["more space", "looser"], down: ["less space", "tighter"] }),
  numberParam({ id: "growth", label: "How fast stripes grow", unit: "ratio", min: 0.05, max: 0.5, step: 0.05, default: 0.2, up: ["steeper", "more graduated"], down: ["gentler"] }),
  numberParam({ id: "angleDeg", label: "Angle", unit: "degrees", min: 0, max: 175, step: 5, default: 0, up: ["turn clockwise"], down: ["turn anticlockwise"] }),
] as const;

const GRADUATED_BANDS = 6;
const IRREGULAR_BANDS = 16;
const DOUBLE_GAP_RATIO = 0.4;
const HAIR_MM = 1;

interface Band {
  readonly width: number;
  readonly gap: number;
  readonly slot: number;
}

/** One cycle of the rhythm. The same cycle repeats across the design plane, so the stripes are continuous. */
export function rhythmCycle(rhythm: number, width: number, gap: number, growth: number, seed: number): Band[] {
  if (rhythm === 1) return Array.from({ length: GRADUATED_BANDS }, (_, at) => ({ width: width * (1 + growth * at), gap, slot: at % 2 }));
  if (rhythm === 2) return [{ width, gap: Math.max(HAIR_MM, gap * DOUBLE_GAP_RATIO), slot: 0 }, { width, gap, slot: 0 }];
  if (rhythm === 3) {
    const rng = makeRng(seed);
    return Array.from({ length: IRREGULAR_BANDS }, (_, at) => ({ width: width * rng.range(0.4, 1.6), gap: gap * rng.range(0.4, 1.6), slot: at % 2 }));
  }
  return [{ width, gap, slot: 0 }];
}

export const stripeRhythm: PatternGenerator = {
  id: "stripe-rhythm",
  label: "Stripe rhythms",
  params: STRIPE_RHYTHM_PARAMS,
  repeat: { kind: "field" },
  maxColours: 2,
  render(context) {
    const values = valuesOf(STRIPE_RHYTHM_PARAMS, context.params);
    const inks = inksOf(context, 2);
    const cycle = rhythmCycle(Math.round(values.rhythm as number), values.widthMm as number, values.gapMm as number, values.growth as number, context.seed);
    const period = cycle.reduce((sum, band) => sum + band.width + band.gap, 0);
    const angle = values.angleDeg as number;
    const across = directionOf(angle);
    const projections = rectPolygon(context.bounds).map((corner) => dot({ x: corner.x - context.datum.x, y: corner.y - context.datum.y }, across));
    const [low, high] = [Math.min(...projections), Math.max(...projections)];
    const reach = Math.hypot(context.bounds.maxX - context.bounds.minX, context.bounds.maxY - context.bounds.minY) * 2;
    const shapes: DisplayShape[] = [];
    for (let c = Math.floor(low / period); c <= Math.floor(high / period); c += 1) {
      let at = c * period;
      for (const band of cycle) {
        const [from, to] = [at, at + band.width];
        at = to + band.gap;
        if (to < low || from > high) continue;
        const outline = [{ x: from, y: -reach }, { x: to, y: -reach }, { x: to, y: reach }, { x: from, y: reach }].map((point) =>
          rotatePoint({ x: context.datum.x + point.x, y: context.datum.y + point.y }, context.datum, angle),
        );
        shapes.push(...clippedShape(outline, context.bounds, inks[band.slot] as string));
      }
    }
    return listOf(shapes, false);
  },
};
