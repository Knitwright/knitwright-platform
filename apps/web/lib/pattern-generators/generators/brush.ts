import type { PointMm } from "@/lib/artwork-stack/units";
import { cellEstimate, cellsNear } from "../cells";
import { budgetScale, defineGenerator, SIMPLIFIED_NOTE } from "../define";
import { polygon } from "../geometry";
import type { GeneratorParam } from "../params";
import { createRng, hashSeed } from "../prng";

const PARAMS: readonly GeneratorParam[] = [
  { id: "length", label: "Stroke length", noun: "brush stroke", unit: "mm", min: 40, max: 300, step: 20, default: 100, words: { up: ["longer", "bigger", "larger"], down: ["shorter", "smaller", "finer"] } },
  { id: "width", label: "Stroke width", noun: "stroke width", unit: "mm", min: 3, max: 30, step: 3, default: 10, words: { up: ["thicker", "wider", "bolder"], down: ["thinner", "narrower", "fine"] } },
  { id: "angle", label: "Stroke angle", noun: "angle", unit: "degrees", min: 0, max: 180, step: 15, default: 35 },
  { id: "angleSpread", label: "How much angles vary", noun: "angle variation", unit: "degrees", min: 0, max: 90, step: 10, default: 20, words: { up: ["messier", "looser", "more varied"], down: ["neater", "more even", "more uniform"] } },
  { id: "coverage", label: "How many strokes", noun: "stroke count", unit: "ratio", min: 0.2, max: 1, step: 0.1, default: 0.5, words: { up: ["busier", "denser", "more strokes"], down: ["calmer", "sparser", "fewer strokes"] } },
];

const MOST_PER_CELL = 5;

/** A stroke: a long body with pointed ends, turned to `degrees` about its centre. */
function strokePoints(centre: PointMm, length: number, width: number, degrees: number): PointMm[] {
  const [cos, sin] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
  const local: readonly (readonly [number, number])[] = [[-0.5, 0], [-0.38, -0.5], [0.3, -0.5], [0.5, 0], [0.38, 0.5], [-0.3, 0.5]];
  return local.map(([x, y]) => ({ x: centre.x + x * length * cos - y * width * sin, y: centre.y + x * length * sin + y * width * cos }));
}

/** Seeded brush strokes, a few to a cell. Each stroke belongs to a whole-number cell, so the field is the same whatever area is drawn. */
export const brush = defineGenerator({
  id: "brush",
  label: "Brush strokes",
  summary: "Loose painted strokes with a rough direction.",
  aliases: ["brush", "brushstroke", "brush stroke", "abstract", "paint", "painted"],
  params: PARAMS,
  maxColours: 4,
  draw({ context, values, inks }) {
    const cell0 = values.length * 0.6;
    const grow = budgetScale(cellEstimate(context.bounds, cell0, cell0, values.length) * MOST_PER_CELL);
    const cell = cell0 * grow;
    const [length, width] = [values.length * grow, values.width * grow];
    const strokes = cellsNear(context.bounds, context.datum, cell, cell, length * 1.2).flatMap(({ i, j }) => {
      const rng = createRng(hashSeed(context.seed, i, j));
      const count = 1 + Math.floor(values.coverage * (MOST_PER_CELL - 1));
      return Array.from({ length: count }, () => {
        const centre = { x: context.datum.x + (i + rng.float()) * cell, y: context.datum.y + (j + rng.float()) * cell };
        const angle = values.angle + rng.range(-values.angleSpread, values.angleSpread);
        const [fill, size] = [inks[rng.int(inks.length)], rng.range(0.7, 1.15)];
        return polygon(strokePoints(centre, length * size, width, angle), fill, "Stroke");
      });
    });
    return { shapes: strokes, ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});
