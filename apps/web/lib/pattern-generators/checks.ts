import type { DisplayShape } from "@/lib/artwork-stack/generator";
import type { BoundsMm } from "@/lib/artwork-stack/units";
import { cellCount, cellsAround, inksOf, mixHex, numberParam, seededOrigin, valuesOf, type TileGenerator } from "./common";
import { intersectBoxes, rectPolygon } from "./geometry";
import { budgetFactor, clippedShape, listOf } from "./shapes";

/** Checks, gingham and houndstooth, from one square tile of two bands each way. A tile pattern: opposite edges of a tile match. */

export const CHECK_KINDS = ["check", "gingham", "houndstooth"] as const;

export const CHECKS_PARAMS = [
  numberParam({ id: "kind", label: "Kind", unit: "none", min: 0, max: 2, step: 1, default: 1, up: [], down: [] }),
  numberParam({ id: "sizeMm", label: "Size of one band", unit: "mm", min: 4, max: 80, step: 4, default: 20, up: ["bigger", "larger", "wider"], down: ["smaller", "finer", "tighter"] }),
] as const;

const DEFAULT_SIZE = 20;
const tileOf = (params: Readonly<Record<string, number>>): { width: number; height: number } => {
  const side = 2 * (params.sizeMm ?? DEFAULT_SIZE);
  return { width: side, height: side };
};

/** True where the dark thread shows in a 2 over 2 twill: houndstooth has 4 dark and 4 light threads each way. */
const twill = (i: number, j: number): boolean => (((i - j) % 4) + 4) % 4 < 2;
const dark = (thread: number): boolean => (((thread % 8) + 8) % 8) < 4;

interface Cell {
  readonly box: BoundsMm;
  readonly fill: string;
}

/** The cells of one tile as rectangles at the tile's own origin, merged along a row where they touch. */
function tileCells(kind: number, side: number, inks: readonly [string, string]): Cell[] {
  const half = side / 2;
  const [light, deep] = inks;
  if (kind === 0) return [{ box: { minX: half, minY: 0, maxX: side, maxY: half }, fill: deep }, { box: { minX: 0, minY: half, maxX: half, maxY: side }, fill: deep }];
  if (kind === 1) {
    const mid = mixHex(light, deep, 0.5);
    return [
      { box: { minX: 0, minY: 0, maxX: half, maxY: half }, fill: deep },
      { box: { minX: half, minY: 0, maxX: side, maxY: half }, fill: mid },
      { box: { minX: 0, minY: half, maxX: half, maxY: side }, fill: mid },
    ];
  }
  const cell = side / 8;
  return Array.from({ length: 8 }, (_, j) => runs((i) => (twill(i, j) ? dark(i) : dark(j)))).flatMap((row, j) =>
    row.map(([from, to]): Cell => ({ box: { minX: from * cell, minY: j * cell, maxX: to * cell, maxY: (j + 1) * cell }, fill: deep })),
  );
}

/** The runs of cells in a row of 8 for which `isDark` holds, as [from, to) pairs. */
function runs(isDark: (i: number) => boolean): [number, number][] {
  const found: [number, number][] = [];
  for (let i = 0; i < 8; i += 1) {
    if (!isDark(i)) continue;
    const last = found[found.length - 1];
    if (last !== undefined && last[1] === i) last[1] = i + 1;
    else found.push([i, i + 1]);
  }
  return found;
}

export const checks: TileGenerator = {
  id: "checks",
  label: "Checks and gingham",
  params: CHECKS_PARAMS,
  repeat: { kind: "tile", tileMm: tileOf({}) },
  maxColours: 2,
  tileOf,
  render(context) {
    const values = valuesOf(CHECKS_PARAMS, context.params);
    const [light, deep] = inksOf(context, 2) as [string, string];
    const kind = Math.round(values.kind as number);
    const per = kind === 2 ? 20 : 3;
    const first = tileOf(values).width;
    const factor = budgetFactor(cellCount(cellsAround(context.bounds, context.datum, first, first)) * per);
    const side = first * factor;
    const cells = tileCells(kind, side, [light, deep]);
    const origin = seededOrigin(context.datum, context.seed, side, side);
    const range = cellsAround(context.bounds, origin, side, side);
    const shapes: DisplayShape[] = clippedShape(rectPolygon(context.bounds), context.bounds, light);
    for (let j = range.j0; j <= range.j1; j += 1) {
      for (let i = range.i0; i <= range.i1; i += 1) {
        const [ox, oy] = [origin.x + i * side, origin.y + j * side];
        for (const cell of cells) {
          const placed = { minX: cell.box.minX + ox, minY: cell.box.minY + oy, maxX: cell.box.maxX + ox, maxY: cell.box.maxY + oy };
          const inside = intersectBoxes(placed, context.bounds);
          if (inside !== null) shapes.push(...clippedShape(rectPolygon(inside), context.bounds, cell.fill));
        }
      }
    }
    return listOf(shapes, factor > 1);
  },
};
