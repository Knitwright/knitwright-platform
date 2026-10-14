import type { DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import { boxesOverlap, directionOf, dot } from "./geometry";
import { cellCount, cellsAround, inksOf, numberParam, seededOrigin, valuesOf } from "./common";
import { budgetFactor, circleShape, listOf } from "./shapes";

/** Halftone: rows of dots whose size ramps along a direction, for a faded dot look. A field: the rows hang from the datum. */

export const HALFTONE_PARAMS = [
  numberParam({ id: "pitchMm", label: "Dot spacing", unit: "mm", min: 4, max: 40, step: 2, default: 12, up: ["wider apart", "bigger", "looser"], down: ["closer", "smaller", "tighter"] }),
  numberParam({ id: "fullSize", label: "Biggest dot", unit: "ratio", min: 0.3, max: 0.95, step: 0.05, default: 0.8, up: ["fuller", "heavier"], down: ["lighter", "daintier"] }),
  numberParam({ id: "angleDeg", label: "Direction of the fade", unit: "degrees", min: 0, max: 360, step: 15, default: 90, up: ["turn clockwise"], down: ["turn anticlockwise"] }),
  numberParam({ id: "lengthMm", label: "Length of the fade", unit: "mm", min: 100, max: 1500, step: 100, default: 500, up: ["longer", "gentler"], down: ["shorter", "quicker"] }),
  numberParam({ id: "reverse", label: "Fade the other way", unit: "yes-no", min: 0, max: 1, step: 1, default: 0, up: [], down: [] }),
] as const;

const SMALLEST_DOT_MM = 0.2;

export const halftone: PatternGenerator = {
  id: "halftone",
  label: "Halftone dots",
  params: HALFTONE_PARAMS,
  repeat: { kind: "field" },
  maxColours: 1,
  render(context) {
    const values = valuesOf(HALFTONE_PARAMS, context.params);
    const [ink] = inksOf(context, 1) as [string];
    const [fullSize, length] = [values.fullSize as number, values.lengthMm as number];
    const direction = directionOf(values.angleDeg as number);
    const reverse = values.reverse === 1;
    const rowEstimate = cellCount(cellsAround(context.bounds, context.datum, values.pitchMm as number, values.pitchMm as number));
    const factor = budgetFactor(rowEstimate);
    const pitch = (values.pitchMm as number) * factor;
    const origin = seededOrigin(context.datum, context.seed, pitch, pitch);
    const range = cellsAround(context.bounds, origin, pitch, pitch, pitch);
    const shapes: DisplayShape[] = [];
    for (let j = range.j0; j <= range.j1; j += 1) {
      for (let i = range.i0; i <= range.i1; i += 1) {
        const centre = { x: origin.x + (i + (Math.abs(j) % 2) * 0.5) * pitch, y: origin.y + j * pitch };
        const along = dot({ x: centre.x - context.datum.x, y: centre.y - context.datum.y }, direction) / length + 0.5;
        const t = Math.min(1, Math.max(0, reverse ? 1 - along : along));
        const radius = (pitch * fullSize * t) / 2;
        const box = { minX: centre.x - radius, minY: centre.y - radius, maxX: centre.x + radius, maxY: centre.y + radius };
        if (radius >= SMALLEST_DOT_MM && boxesOverlap(box, context.bounds)) shapes.push(circleShape(centre, radius, ink));
      }
    }
    return listOf(shapes, factor > 1);
  },
};
