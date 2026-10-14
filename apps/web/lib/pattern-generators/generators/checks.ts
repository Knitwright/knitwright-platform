import { roundMm } from "@/lib/artwork-stack/units";
import { darken } from "../colour";
import { budgetScale, defineGenerator, SIMPLIFIED_NOTE, type Tile } from "../define";
import { rectangle } from "../geometry";
import type { GeneratorParam, Values } from "../params";
import { tileCount, tilesOver } from "../tiles";

const CHECK_PARAMS: readonly GeneratorParam[] = [
  { id: "size", label: "Check size", noun: "check", unit: "mm", min: 10, max: 100, step: 10, default: 40, words: { up: ["bigger", "larger", "wider"], down: ["smaller", "finer", "tighter"] } },
  { id: "ratio", label: "Check height compared with width", noun: "check height", unit: "ratio", min: 0.5, max: 2, step: 0.25, default: 1, words: { up: ["taller"], down: ["flatter", "squatter"] } },
];

const checkTile = (values: Values): Tile => ({ width: roundMm(2 * values.size), height: roundMm(2 * values.size * values.ratio) });

/** Squares in two colours, like a chessboard. The second colour fills the other squares; with one colour they show the colour under. */
export const checks = defineGenerator({
  id: "checks",
  label: "Checks",
  summary: "A chessboard of squares in one or two colours.",
  aliases: ["checks", "check", "checkerboard", "chequered", "checkered"],
  params: CHECK_PARAMS,
  maxColours: 2,
  tileFor: checkTile,
  draw({ context, values, inks }) {
    const grow = budgetScale(tileCount(context.bounds, checkTile(values), 1) * 4);
    const tile = grow > 1 ? { width: roundMm(checkTile(values).width * grow), height: roundMm(checkTile(values).height * grow) } : checkTile(values);
    const [w, h] = [tile.width / 2, tile.height / 2];
    const shapes = tilesOver(context.bounds, tile, 1, context.datum).flatMap(({ origin: o }) => [
      rectangle(o.x, o.y, o.x + w, o.y + h, inks[0], "Check"),
      rectangle(o.x + w, o.y + h, o.x + 2 * w, o.y + 2 * h, inks[0], "Check"),
      ...(inks.length > 1 ? [rectangle(o.x + w, o.y, o.x + 2 * w, o.y + h, inks[1], "Check"), rectangle(o.x, o.y + h, o.x + w, o.y + 2 * h, inks[1], "Check")] : []),
    ]);
    return { shapes, ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});

const GINGHAM_PARAMS: readonly GeneratorParam[] = [
  { id: "size", label: "Check size", noun: "check", unit: "mm", min: 8, max: 60, step: 4, default: 20, words: { up: ["bigger", "larger", "wider"], down: ["smaller", "finer", "tighter"] } },
  { id: "contrast", label: "Depth where bands cross", noun: "crossing depth", unit: "ratio", min: 0, max: 0.6, step: 0.1, default: 0.35, words: { up: ["deeper", "stronger", "darker crossings"], down: ["softer", "flatter"] } },
];

const ginghamTile = (values: Values): Tile => ({ width: roundMm(2 * values.size), height: roundMm(2 * values.size) });

/** Bands of the main colour across and down on the colour under, deeper where they cross. */
export const gingham = defineGenerator({
  id: "gingham",
  label: "Gingham",
  summary: "Crossing bands, deeper where they meet.",
  aliases: ["gingham", "picnic check"],
  params: GINGHAM_PARAMS,
  maxColours: 2,
  tileFor: ginghamTile,
  draw({ context, values, inks }) {
    const base = ginghamTile(values);
    const grow = budgetScale(tileCount(context.bounds, base, 1) * 3);
    const tile = grow > 1 ? { width: roundMm(base.width * grow), height: roundMm(base.height * grow) } : base;
    const half = tile.width / 2;
    const crossing = inks[1] ?? darken(inks[0], values.contrast);
    const shapes = tilesOver(context.bounds, tile, 1, context.datum).flatMap(({ origin: o }) => [
      rectangle(o.x, o.y, o.x + half, o.y + tile.height, inks[0], "Band"),
      rectangle(o.x, o.y, o.x + tile.width, o.y + half, inks[0], "Band"),
      rectangle(o.x, o.y, o.x + half, o.y + half, crossing, "Crossing"),
    ]);
    return { shapes, ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});

const HOUND_PARAMS: readonly GeneratorParam[] = [
  { id: "size", label: "Pattern size", noun: "pattern", unit: "mm", min: 24, max: 120, step: 8, default: 48, words: { up: ["bigger", "larger", "wider"], down: ["smaller", "finer", "tighter"] } },
];

const houndTile = (values: Values): Tile => ({ width: roundMm(values.size), height: roundMm(values.size) });

const GRID = 8;
/** Four threads dark, four light, in both directions, woven two over and two under: the weave that makes the teeth. */
const darkAt = (x: number, y: number): boolean => ((x + y) % 4 < 2 ? x % GRID : y % GRID) < GRID / 2;

/** Each row of the weave as runs of equal colour: [first cell, cells in the run, dark]. */
const RUNS: readonly (readonly (readonly [number, number, boolean])[])[] = Array.from({ length: GRID }, (_, y) =>
  Array.from({ length: GRID }, (_, x) => x).reduce<[number, number, boolean][]>((runs, x) => {
    const dark = darkAt(x, y);
    const last = runs[runs.length - 1];
    return last !== undefined && last[2] === dark ? [...runs.slice(0, -1), [last[0], last[1] + 1, dark]] : [...runs, [x, 1, dark]];
  }, []),
);

const SHAPES_PER_TILE = RUNS.reduce((sum, row) => sum + row.length, 0);

/** The houndstooth weave on an eight by eight grid: dark cells in the main colour, light cells in the second, or the colour under. */
export const houndstooth = defineGenerator({
  id: "houndstooth",
  label: "Houndstooth",
  summary: "Small broken checks with pointed teeth.",
  aliases: ["houndstooth", "dogtooth", "hounds tooth"],
  params: HOUND_PARAMS,
  maxColours: 2,
  tileFor: houndTile,
  draw({ context, values, inks }) {
    const base = houndTile(values);
    const grow = budgetScale(tileCount(context.bounds, base, 1) * SHAPES_PER_TILE);
    const tile = grow > 1 ? { width: roundMm(base.width * grow), height: roundMm(base.height * grow) } : base;
    const u = tile.width / GRID;
    const shapes = tilesOver(context.bounds, tile, 1, context.datum).flatMap(({ origin: o }) =>
      RUNS.flatMap((row, y) =>
        row.flatMap(([x, count, dark]) => {
          const ink = dark ? inks[0] : inks[1];
          return ink === undefined ? [] : [rectangle(o.x + x * u, o.y + y * u, o.x + (x + count) * u, o.y + (y + 1) * u, ink, "Tooth")];
        }),
      ),
    );
    return { shapes, ...(grow > 1 ? { note: SIMPLIFIED_NOTE } : {}) };
  },
});
