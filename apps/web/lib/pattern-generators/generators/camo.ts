import type { PointMm } from "@/lib/artwork-stack/units";
import { cellEstimate, cellsNear } from "../cells";
import { darken } from "../colour";
import { budgetScale, defineGenerator, SIMPLIFIED_NOTE } from "../define";
import { polygon, rectangle } from "../geometry";
import type { GeneratorParam } from "../params";
import { createRng, hashSeed, type Rng } from "../prng";

const PARAMS: readonly GeneratorParam[] = [
  { id: "scale", label: "Camo blob size", noun: "camo blob", unit: "mm", min: 30, max: 120, step: 10, default: 60, words: { up: ["bigger", "larger", "chunkier"], down: ["smaller", "finer", "tinier"] } },
  { id: "spread", label: "How much it covers", noun: "camo coverage", unit: "ratio", min: 0.2, max: 1, step: 0.1, default: 0.6, words: { up: ["busier", "denser", "fuller"], down: ["sparser", "calmer", "emptier"] } },
  { id: "roughness", label: "Ragged edges", noun: "camo roughness", unit: "ratio", min: 0.1, max: 0.5, step: 0.1, default: 0.3, words: { up: ["rougher", "more ragged"], down: ["smoother", "softer"] } },
];

const SIDES = 12;
const MOST_COLOURS = 5;
/** The farthest a blob reaches from its cell, in cells: radius 0.6, ragged edge 1.5, stretch 1.6, plus the cell itself. */
const REACH_CELLS = 3;

function blobPoints(rng: Rng, centre: PointMm, radius: number, roughness: number): PointMm[] {
  const stretch = rng.range(1, 1.6);
  const turn = rng.range(0, Math.PI);
  return Array.from({ length: SIDES }, (_, at) => {
    const angle = (2 * Math.PI * at) / SIDES;
    const r = radius * (1 + roughness * (rng.float() * 2 - 1));
    const [x, y] = [r * Math.cos(angle) * stretch, r * Math.sin(angle)];
    return { x: centre.x + x * Math.cos(turn) - y * Math.sin(turn), y: centre.y + x * Math.sin(turn) + y * Math.cos(turn) };
  });
}

/** Three to five colours, padded with darker shades of the main one when fewer are given. */
const paletteOf = (inks: readonly string[]): string[] =>
  Array.from({ length: Math.max(3, Math.min(MOST_COLOURS, inks.length)) }, (_, at) => inks[at] ?? darken(inks[0], 0.2 * at));

/** Layered, seeded blobs on a grid laid from the datum. A blob belongs to a whole-number cell, so any area gives the same blobs. */
export const camo = defineGenerator({
  id: "camo",
  label: "Camo",
  summary: "Layered blobs in three to five colours.",
  aliases: ["camo", "camouflage"],
  params: PARAMS,
  maxColours: MOST_COLOURS,
  draw({ context, values, inks }) {
    const palette = paletteOf(inks);
    const layers = palette.length - 1;
    const grow = budgetScale(layers * cellEstimate(context.bounds, values.scale, values.scale, REACH_CELLS * values.scale));
    const cell = values.scale * grow;
    const radius = cell * (0.3 + 0.3 * values.spread);
    const base = rectangle(context.bounds.minX, context.bounds.minY, context.bounds.maxX, context.bounds.maxY, palette[0], "Camo base");
    const blobs = palette.slice(1).flatMap((fill, layer) =>
      cellsNear(context.bounds, context.datum, cell, cell, REACH_CELLS * cell).flatMap(({ i, j }) => {
        const rng = createRng(hashSeed(context.seed, layer, i, j));
        const centre = { x: context.datum.x + (i + rng.float()) * cell, y: context.datum.y + (j + rng.float()) * cell };
        const there = rng.float() < 0.25 + 0.4 * values.spread;
        const points = blobPoints(rng, centre, radius, values.roughness);
        return there ? [polygon(points, fill, "Camo blob")] : [];
      }),
    );
    return { shapes: [base, ...blobs], ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});
