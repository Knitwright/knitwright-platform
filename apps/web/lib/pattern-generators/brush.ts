import type { DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { PointMm } from "@/lib/artwork-stack/units";
import { cellCount, cellsAround, inksOf, numberParam, valuesOf } from "./common";
import { directionOf } from "./geometry";
import { cellRng } from "./rng";
import { budgetFactor, clippedShape, listOf } from "./shapes";

/** Brush and abstract: seeded strokes with a spread of angle, length and width, over the ground. A field: strokes hang from the datum. */

const SALT = 0xb7;

export const BRUSH_PARAMS = [
  numberParam({ id: "lengthMm", label: "Stroke length", unit: "mm", min: 40, max: 400, step: 20, default: 150, up: ["longer", "sweepier"], down: ["shorter", "choppier"] }),
  numberParam({ id: "widthMm", label: "Stroke width", unit: "mm", min: 3, max: 40, step: 2, default: 12, up: ["wider", "thicker", "bolder"], down: ["thinner", "finer"] }),
  numberParam({ id: "angleDeg", label: "Main direction", unit: "degrees", min: 0, max: 180, step: 15, default: 30, up: ["turn clockwise"], down: ["turn anticlockwise"] }),
  numberParam({ id: "angleSpread", label: "Spread of direction", unit: "degrees", min: 0, max: 90, step: 10, default: 25, up: ["wilder", "messier"], down: ["neater", "more uniform"] }),
  numberParam({ id: "cover", label: "How much is covered", unit: "ratio", min: 0.2, max: 2, step: 0.2, default: 0.8, up: ["busier", "denser"], down: ["sparser", "lighter"] }),
] as const;

/** A stroke: pointed at both ends, with a bend to one side, as a six point outline. */
function stroke(centre: PointMm, length: number, width: number, degrees: number, bend: number): PointMm[] {
  const [along, across] = [directionOf(degrees), directionOf(degrees + 90)];
  const at = (u: number, v: number): PointMm => ({ x: centre.x + along.x * u + across.x * v, y: centre.y + along.y * u + across.y * v });
  const half = length / 2;
  return [at(-half, bend), at(-half / 2, bend - width / 2 + bend / 2), at(half / 2, bend / 2 - width / 2), at(half, 0), at(half / 2, bend / 2 + width / 2), at(-half / 2, bend + width / 2 + bend / 2)];
}

export const brush: PatternGenerator = {
  id: "brush",
  label: "Brush strokes",
  params: BRUSH_PARAMS,
  repeat: { kind: "field" },
  maxColours: 4,
  render(context) {
    const values = valuesOf(BRUSH_PARAMS, context.params);
    const inks = inksOf(context, Math.min(4, Math.max(1, context.colours.length)));
    const [length, width, cover] = [values.lengthMm as number, values.widthMm as number, values.cover as number];
    const cell0 = length * 0.7;
    const factor = budgetFactor(cellCount(cellsAround(context.bounds, context.datum, cell0, cell0, length)) * Math.ceil(cover * 2));
    const [cell, scaled] = [cell0 * factor, factor];
    const range = cellsAround(context.bounds, context.datum, cell, cell, length * scaled);
    const shapes: DisplayShape[] = [];
    for (let j = range.j0; j <= range.j1; j += 1) {
      for (let i = range.i0; i <= range.i1; i += 1) {
        const rng = cellRng(context.seed, SALT, i, j);
        const count = Math.floor(cover) + (rng.next() < cover - Math.floor(cover) ? 1 : 0);
        for (let k = 0; k < count; k += 1) {
          const centre = { x: context.datum.x + (i + rng.next()) * cell, y: context.datum.y + (j + rng.next()) * cell };
          const degrees = (values.angleDeg as number) + (rng.next() - 0.5) * 2 * (values.angleSpread as number);
          const outline = stroke(centre, length * scaled * rng.range(0.6, 1.2), width * scaled * rng.range(0.6, 1.3), degrees, rng.range(-0.15, 0.15) * length);
          shapes.push(...clippedShape(outline, context.bounds, inks[rng.int(0, inks.length - 1)] as string));
        }
      }
    }
    return listOf(shapes, factor > 1);
  },
};
