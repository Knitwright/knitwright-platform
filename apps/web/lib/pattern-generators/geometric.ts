import type { DisplayShape, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { PointMm } from "@/lib/artwork-stack/units";
import { cellCount, cellsAround, inksOf, numberParam, seededOrigin, valuesOf } from "./common";
import { rectPolygon, regularPolygon, scaleAbout } from "./geometry";
import { budgetFactor, clippedShape, listOf } from "./shapes";

/** Geometric: chevrons, diamonds, triangles or hexagons on a lattice, in two alternating colours over a base. A field: the lattice hangs from the datum. */

export const GEOMETRIC_MOTIFS = ["chevron", "diamonds", "triangles", "hexagons"] as const;

export const GEOMETRIC_PARAMS = [
  numberParam({ id: "motif", label: "Shape", unit: "none", min: 0, max: 3, step: 1, default: 0, up: [], down: [] }),
  numberParam({ id: "sizeMm", label: "Shape size", unit: "mm", min: 10, max: 100, step: 5, default: 30, up: ["bigger", "larger"], down: ["smaller", "finer"] }),
  numberParam({ id: "gapMm", label: "Gap between shapes", unit: "mm", min: 0, max: 20, step: 1, default: 2, up: ["more space", "looser"], down: ["less space", "tighter"] }),
] as const;

const SQRT3 = Math.sqrt(3);

type Motif = (x: number, y: number, size: number) => PointMm[];

const chevron: Motif = (x, y, s) => [
  { x, y: y + s * 0.5 }, { x: x + s / 2, y }, { x: x + s, y: y + s * 0.5 },
  { x: x + s, y: y + s }, { x: x + s / 2, y: y + s * 0.5 }, { x, y: y + s },
];
const diamond: Motif = (x, y, s) => [{ x: x + s / 2, y }, { x: x + s, y: y + s / 2 }, { x: x + s / 2, y: y + s }, { x, y: y + s / 2 }];
const upTriangle: Motif = (x, y, s) => [{ x: x + s / 2, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const downTriangle: Motif = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s / 2, y: y + s }];

function motifShapes(motif: number, i: number, j: number, cell: number, datum: PointMm): { points: PointMm[]; slot: number } {
  const [x, y] = [datum.x + i * cell, datum.y + j * cell];
  const slot = (((i + j) % 2) + 2) % 2;
  if (motif === 0) return { points: chevron(x, y, cell), slot: ((j % 2) + 2) % 2 };
  if (motif === 1) return { points: diamond(x, y, cell), slot };
  if (motif === 2) return { points: (slot === 0 ? upTriangle : downTriangle)(x, y, cell), slot };
  const centre = { x: x + (((j % 2) + 2) % 2) * cell * 0.5 + cell / 2, y: datum.y + j * cell * (SQRT3 / 2) + cell / 2 };
  return { points: regularPolygon(centre, cell / SQRT3, 6, 30), slot };
}

export const geometric: PatternGenerator = {
  id: "geometric",
  label: "Geometric",
  params: GEOMETRIC_PARAMS,
  repeat: { kind: "field" },
  maxColours: 3,
  render(context) {
    const values = valuesOf(GEOMETRIC_PARAMS, context.params);
    const [base, first, second] = inksOf(context, 3) as [string, string, string];
    const motif = Math.round(values.motif as number);
    const factor = budgetFactor(cellCount(cellsAround(context.bounds, context.datum, values.sizeMm as number, values.sizeMm as number)));
    const cell = (values.sizeMm as number) * factor;
    const origin = seededOrigin(context.datum, context.seed, cell, cell);
    const shrink = Math.max(0.1, 1 - (values.gapMm as number) / (values.sizeMm as number));
    const hexRows = motif === 3 ? SQRT3 / 2 : 1;
    const range = cellsAround(context.bounds, origin, cell, cell * hexRows, cell);
    const shapes: DisplayShape[] = clippedShape(rectPolygon(context.bounds), context.bounds, base);
    for (let j = range.j0; j <= range.j1; j += 1) {
      for (let i = range.i0; i <= range.i1; i += 1) {
        const { points, slot } = motifShapes(motif, i, j, cell, origin);
        const centre = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
        shapes.push(...clippedShape(scaleAbout(points, centre, shrink), context.bounds, slot === 0 ? first : second));
      }
    }
    return listOf(shapes, factor > 1);
  },
};
