import type { ParamValue, PatternGenerator } from "@/lib/artwork-stack/generator";
import type { MatchBudget } from "./budget";
import { rasterise, type Frame, type Labels, type Rect, type Rgb } from "./grid";

/**
 * Scoring a generator against a flat. The pattern is drawn once over a frame a little bigger than the block being
 * scored, then slid over the block pixel by pixel: sliding costs no new drawing, so where the pattern starts is
 * found cheaply. The error is the share of pixels whose colour differs from the picture's, 0 to 1.
 */

export type Params = Readonly<Record<string, ParamValue>>;

export interface Scene {
  readonly flat: Labels;
  readonly rect: Rect;
  readonly palette: readonly Rgb[];
  /** The palette number of the colour under the pattern. */
  readonly ground: number;
  readonly groundHex: string;
  /** Design millimetres of the flat's pixel (0, 0) corner, and millimetres to a pixel side. */
  readonly originX: number;
  readonly originY: number;
  readonly step: number;
  /** One period of the picture in pixels along each axis, or null when it does not repeat along that axis. */
  readonly periodX: number | null;
  readonly periodY: number | null;
  /** Where a zero offset puts the repeat datum, in design millimetres. */
  readonly datum: { readonly x: number; readonly y: number };
  readonly view: "front" | "back";
}

export interface Shift {
  readonly sx: number;
  readonly sy: number;
}

export interface Trial {
  readonly generatorId: string;
  readonly params: Params;
  readonly inks: readonly string[];
  readonly error: number;
  readonly shift: Shift;
}

const MOST_COARSE_SHIFTS = 12;
const LOCAL_REACH = 2;
/** About this many pixels of the block are compared for each shift; a bigger block is sampled every few pixels. */
const SAMPLE_PIXELS = 16_000;

/** Every how many pixels the block is sampled. */
export const strideOf = (rect: Rect): number => Math.max(1, Math.ceil(Math.sqrt(((rect.x1 - rect.x0) * (rect.y1 - rect.y0)) / SAMPLE_PIXELS)));

/** The share of sampled pixels of the block that differ from the drawing slid by `shift`. */
export function mismatch(scene: Scene, big: Labels, shift: Shift, stride: number, window: Rect): { errors: number; total: number } {
  const { flat, rect } = scene;
  let errors = 0;
  let total = 0;
  for (let y = window.y0; y < window.y1; y += stride) {
    const row = y * flat.width;
    const bigRow = (y - rect.y0 + shift.sy) * big.width - rect.x0 + shift.sx;
    for (let x = window.x0; x < window.x1; x += stride) {
      total += 1;
      if (flat.data[row + x] !== big.data[bigRow + x]) errors += 1;
    }
  }
  return { errors, total };
}

const sampled = (window: Rect, stride: number): number => Math.ceil((window.x1 - window.x0) / stride) * Math.ceil((window.y1 - window.y0) / stride);

function best(scene: Scene, big: Labels, shifts: readonly Shift[], stride: number, window: Rect, budget: MatchBudget): { shift: Shift; error: number } | null {
  let found: { shift: Shift; error: number } | null = null;
  for (const shift of shifts) {
    if (!budget.takeComparisons(sampled(window, stride))) break;
    const { errors, total } = mismatch(scene, big, shift, stride, window);
    const error = total === 0 ? 1 : errors / total;
    if (found === null || error < found.error) found = { shift, error };
  }
  return found;
}

const range = (from: number, to: number, by: number): number[] => Array.from({ length: Math.max(0, Math.ceil((to - from) / by)) }, (_, at) => from + at * by);

/** All shifts along the axes that repeat; an axis that does not repeat is not slid. */
function grid(scene: Scene, stepX: number, stepY: number): Shift[] {
  const xs = scene.periodX === null ? [0] : range(0, scene.periodX, stepX);
  const ys = scene.periodY === null ? [0] : range(0, scene.periodY, stepY);
  return ys.flatMap((sy) => xs.map((sx) => ({ sx, sy })));
}

const clampShift = (scene: Scene, shift: Shift): Shift => ({
  sx: scene.periodX === null ? 0 : Math.min(scene.periodX, Math.max(0, shift.sx)),
  sy: scene.periodY === null ? 0 : Math.min(scene.periodY, Math.max(0, shift.sy)),
});

/** Where the pattern starts: a coarse slide over one period, then finer slides around the best. */
export function findShift(scene: Scene, big: Labels, window: Rect, budget: MatchBudget): { shift: Shift; error: number } | null {
  const base = strideOf(window);
  const coarseX = Math.max(1, Math.ceil((scene.periodX ?? 1) / MOST_COARSE_SHIFTS));
  const coarseY = Math.max(1, Math.ceil((scene.periodY ?? 1) / MOST_COARSE_SHIFTS));
  const rough = best(scene, big, grid(scene, coarseX, coarseY), base * 2, window, budget);
  if (rough === null) return null;
  const middle = nearby(scene, big, rough.shift, Math.max(coarseX, coarseY), base * 2, window, budget);
  return middle === null ? null : nearby(scene, big, middle.shift, 1, base, window, budget);
}

/** The best shift within `reach` pixels of `from`, sampled every `stride` pixels over a window of the block. */
export function nearby(scene: Scene, big: Labels, from: Shift, reach: number, stride: number, window: Rect, budget: MatchBudget): { shift: Shift; error: number } | null {
  const shifts: Shift[] = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) shifts.push(clampShift(scene, { sx: from.sx + dx, sy: from.sy + dy }));
  }
  const seen = new Set<string>();
  const unique = shifts.filter((s) => {
    const key = `${s.sx},${s.sy}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
  return best(scene, big, unique, stride, window, budget);
}

/** A block this many periods across or more is scored in four windows, each finding its own start, so a slightly skewed fit of a photo is not counted against the pattern. */
const SPLIT_PERIODS = 4;

export function windowsOf(scene: Scene): Rect[] {
  const { rect } = scene;
  const [w, h] = [rect.x1 - rect.x0, rect.y1 - rect.y0];
  const splitX = scene.periodX !== null && w >= SPLIT_PERIODS * scene.periodX;
  const splitY = scene.periodY !== null && h >= SPLIT_PERIODS * scene.periodY;
  const xs = splitX ? [rect.x0, rect.x0 + Math.floor(w / 2), rect.x1] : [rect.x0, rect.x1];
  const ys = splitY ? [rect.y0, rect.y0 + Math.floor(h / 2), rect.y1] : [rect.y0, rect.y1];
  return ys.slice(0, -1).flatMap((y0, j) => xs.slice(0, -1).map((x0, i) => ({ x0, y0, x1: xs[i + 1], y1: ys[j + 1] })));
}

/** One drawing of `generator` at `params`, scored. Null when the budget is spent. */
export function trial(
  scene: Scene,
  generator: PatternGenerator,
  params: Params,
  inks: readonly string[],
  budget: MatchBudget,
  seed: number,
  hint: Shift | null,
): Trial | null {
  if (!budget.takeRender()) return null;
  const frame: Frame = {
    originX: scene.originX + scene.rect.x0 * scene.step,
    originY: scene.originY + scene.rect.y0 * scene.step,
    step: scene.step,
    width: scene.rect.x1 - scene.rect.x0 + (scene.periodX ?? 0) + 1,
    height: scene.rect.y1 - scene.rect.y0 + (scene.periodY ?? 0) + 1,
  };
  const list = generator.render({
    view: scene.view,
    bounds: { minX: frame.originX, minY: frame.originY, maxX: frame.originX + frame.width * frame.step, maxY: frame.originY + frame.height * frame.step },
    landmarks: {},
    datum: scene.datum,
    colours: inks,
    ground: scene.groundHex,
    params,
    seed,
  });
  const big = rasterise(list, frame, scene.palette, scene.ground);
  const found = windowsOf(scene).map((window) => (hint === null ? findShift(scene, big, window, budget) : nearby(scene, big, hint, LOCAL_REACH, strideOf(window), window, budget)));
  if (found.some((f) => f === null)) return null;
  const parts = found as { shift: Shift; error: number }[];
  const weights = windowsOf(scene).map((w) => (w.x1 - w.x0) * (w.y1 - w.y0));
  const error = parts.reduce((sum, p, at) => sum + p.error * weights[at], 0) / weights.reduce((a, b) => a + b, 0);
  return { generatorId: generator.id, params, inks, error, shift: parts[0].shift };
}
