import { budgetScale, defineGenerator, SIMPLIFIED_NOTE } from "../define";
import { circle } from "../geometry";
import type { GeneratorParam } from "../params";
import { cellEstimate, cellsNear } from "../cells";

const PARAMS: readonly GeneratorParam[] = [
  { id: "pitch", label: "Dot spacing", noun: "dot spacing", unit: "mm", min: 8, max: 30, step: 2, default: 12, words: { up: ["coarser", "more spaced"], down: ["finer", "tighter"] } },
  { id: "rampLength", label: "Fade length", noun: "fade", unit: "mm", min: 100, max: 2000, step: 100, default: 700, words: { up: ["longer fade", "more gradual"], down: ["shorter fade", "quicker"] } },
  { id: "angle", label: "Direction", noun: "direction", unit: "degrees", min: 0, max: 360, step: 15, default: 90 },
  { id: "maxDot", label: "Biggest dot", noun: "dot", unit: "ratio", min: 0.3, max: 1, step: 0.1, default: 0.9, words: { up: ["bolder", "bigger dots"], down: ["lighter dots", "smaller dots"] } },
  { id: "minDot", label: "Smallest dot", noun: "smallest dot", unit: "ratio", min: 0, max: 0.4, step: 0.05, default: 0.05 },
];

const ROW = Math.sqrt(3) / 2;
/** Dots smaller than this would not print. */
const TINIEST_MM = 0.2;

/** Dots whose size changes along a direction, for a faded dot look. Rows are staggered; the lattice is laid from the datum. */
export const halftone = defineGenerator({
  id: "halftone",
  label: "Halftone dots",
  summary: "Dots that grow or shrink along a direction.",
  aliases: ["halftone", "dots fade", "faded dots", "dot fade"],
  params: PARAMS,
  maxColours: 1,
  period: (values) => ({ width: values.pitch, height: values.pitch * 2 * ROW }),
  draw({ context, values, inks }) {
    const grow = budgetScale(cellEstimate(context.bounds, values.pitch, values.pitch * ROW, values.pitch));
    const pitch = values.pitch * grow;
    const rowStep = pitch * ROW;
    const [ux, uy] = [Math.cos((values.angle * Math.PI) / 180), Math.sin((values.angle * Math.PI) / 180)];
    const dots = cellsNear(context.bounds, context.datum, pitch, rowStep, pitch).flatMap(({ i, j }) => {
      const centre = { x: context.datum.x + (i + (Math.abs(j) % 2) * 0.5) * pitch, y: context.datum.y + j * rowStep };
      const t = Math.min(1, Math.max(0, ((centre.x - context.datum.x) * ux + (centre.y - context.datum.y) * uy) / values.rampLength));
      const radius = (pitch / 2) * (values.maxDot + (values.minDot - values.maxDot) * t);
      return radius < TINIEST_MM ? [] : [circle(centre, radius, inks[0], "Dot")];
    });
    return { shapes: dots, ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});
