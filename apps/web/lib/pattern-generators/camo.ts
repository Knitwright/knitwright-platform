import type { DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { PointMm } from "@/lib/artwork-stack/units";
import { cellsAround, cellCount, coloursAvailable, inksOf, numberParam, valuesOf } from "./common";
import { directionOf, rectPolygon } from "./geometry";
import { cellRng } from "./rng";
import { budgetFactor, clippedShape, listOf } from "./shapes";

/** Camo: a base colour with layers of seeded blobs over it, one colour a layer. A field: blobs hang from the datum, so pieces cut from one design plane meet. */

const BLOB_SIDES = 12;
const SALT = 0x0ca;

export const CAMO_PARAMS = [
  numberParam({ id: "scaleMm", label: "Blob size", unit: "mm", min: 20, max: 120, step: 10, default: 60, up: ["bigger", "larger", "chunkier"], down: ["smaller", "finer", "tighter"] }),
  numberParam({ id: "spread", label: "How crowded", unit: "ratio", min: 0.3, max: 1.5, step: 0.1, default: 0.8, up: ["busier", "denser", "more crowded"], down: ["sparser", "calmer", "more open"] }),
  numberParam({ id: "rough", label: "Ragged edges", unit: "ratio", min: 0, max: 1, step: 0.1, default: 0.5, up: ["rougher", "more ragged"], down: ["smoother", "rounder"] }),
  numberParam({ id: "colourCount", label: "Colours", unit: "count", min: 2, max: 5, step: 1, default: 4, up: ["more colours"], down: ["fewer colours"] }),
] as const;

function blob(centre: PointMm, radius: number, rough: number, next: () => number): PointMm[] {
  return Array.from({ length: BLOB_SIDES }, (_, at) => {
    const reach = radius * (1 + rough * (next() - 0.5) * 1.2);
    const direction = directionOf((360 * at) / BLOB_SIDES);
    return { x: centre.x + direction.x * reach, y: centre.y + direction.y * reach };
  });
}

export const camo: PatternGenerator = {
  id: "camo",
  label: "Camo",
  params: CAMO_PARAMS,
  repeat: { kind: "field" },
  maxColours: 5,
  render(context) {
    const values = valuesOf(CAMO_PARAMS, context.params);
    const layers = coloursAvailable(context, Math.round(values.colourCount as number)) - 1;
    const inks = inksOf(context, layers + 1);
    const [scale, spread, rough] = [values.scaleMm as number, values.spread as number, values.rough as number];
    const probe = cellsAround(context.bounds, context.datum, scale * 1.5, scale * 1.5, scale);
    const factor = budgetFactor(cellCount(probe) * layers * (Math.floor(spread * 2) + 1));
    const [size, cell] = [scale * factor, scale * 1.5 * factor];
    const range = cellsAround(context.bounds, context.datum, cell, cell, size);
    const shapes: DisplayShape[] = clippedShape(rectPolygon(context.bounds), context.bounds, inks[0] as string);
    for (let layer = 1; layer <= layers; layer += 1) {
      for (let j = range.j0; j <= range.j1; j += 1) {
        for (let i = range.i0; i <= range.i1; i += 1) {
          const rng = cellRng(context.seed, SALT + layer, i, j);
          const count = Math.floor(spread * 2) + (rng.next() < spread * 2 - Math.floor(spread * 2) ? 1 : 0);
          for (let k = 0; k < count; k += 1) {
            const centre = { x: context.datum.x + (i + rng.next()) * cell, y: context.datum.y + (j + rng.next()) * cell };
            shapes.push(...clippedShape(blob(centre, (size / 2) * rng.range(0.6, 1.2), rough, rng.next), context.bounds, inks[layer] as string));
          }
        }
      }
    }
    return listOf(shapes, factor > 1);
  },
};
