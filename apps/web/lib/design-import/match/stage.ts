import { findRepeat, seamReport } from "@/lib/artwork-intake";
import type { Layer, StackColour, ViewId } from "@/lib/artwork-stack";
import type { PatternGenerator } from "@/lib/artwork-stack/generator";
import { getGenerator } from "@/lib/pattern-generators";
import { dpiWarning, effectiveDpi, type MatchSummary, type PatternInput, type PatternProposal, type PatternStage, type PictureCut } from "../pattern";
import { clamp01, round2 } from "../types";
import { budgetSentence, MATCH_LIMITS, type MatchBudget } from "./budget";
import { candidatesFor, NUDGES, type Candidate } from "./estimate";
import { classify, crop, hexToRgb, interiorRect, ownColours, profile, regionCount, type Labels, type Rect, type Rgb } from "./grid";
import { cutOf, generatorLayer, layerIds, pictureLayer, repeatOf, repeatSentence, type Placed } from "./layers";
import { trial, type Scene, type Trial } from "./search";

/**
 * Step 7, the real all-over pattern stage. It finds the picture's repeat with W7b's `findRepeat`, then tries each of
 * W7c's styles that can be read from a repeat, fitting its settings and scoring the share of pixels that differ.
 * Under the limit the style is proposed (clean, scalable, recolourable) with the repeating picture kept as the
 * alternative. Over it, the repeating picture is proposed; with no repeat at all, one full-panel picture per view.
 */

/** A proposed style must differ from the picture on no more than this share of the pixels scored. A setting, not a measurement. */
export const ERROR_LIMIT = 0.15;
/** With no repeat, a block must hold this many separate patches of colour to count as a pattern rather than plain blocks of colour. */
const BUSY_REGIONS = 8;
/** A patch smaller than this many pixels is a speck, not counted. */
const LEAST_PATCH_PX = 12;
/** A colour under this share of the scored block is a speck, not part of a pattern. */
const MIN_INK_SHARE = 0.02;
const MARGIN_PX = 3;
const MIN_BLOCK_PX = 24;
const MOST_TILE_PX = 2048;

interface StageOptions {
  readonly budget: MatchBudget;
  readonly lookup?: (id: string) => PatternGenerator | undefined;
}

interface Read {
  readonly input: PatternInput;
  readonly rect: Rect;
  readonly labels: Labels;
  readonly palette: readonly Rgb[];
  /** The garment's own colours, ground first: the palette's names in the stack. */
  readonly colours: readonly StackColour[];
  readonly groundHex: string;
  readonly inkIndexes: readonly number[];
  readonly inkShare: number;
  readonly regions: () => number;
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

function read(input: PatternInput): Read | null {
  const all = input.colours.map((c) => hexToRgb(c.screen ?? "#000000"));
  if (all.length < 2) return null;
  const rect = interiorRect(input.mask, input.flat.width, input.flat.height, MARGIN_PX, MIN_BLOCK_PX);
  if (rect === null) return null;
  const rough = profile(classify(input.flat, input.mask, all), rect, all.length);
  const roughTotal = rough.reduce((a, b) => a + b, 0);
  const kept = ownColours(all, rough.map((count) => (roughTotal === 0 ? 0 : count / roughTotal)));
  const colours = kept.map((at) => input.colours[at]);
  const palette = kept.map((at) => all[at]);
  const labels = classify(input.flat, input.mask, palette);
  const counts = profile(labels, rect, palette.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const inkIndexes = counts
    .map((count, at) => ({ at, share: total === 0 ? 0 : count / total }))
    .filter((c) => c.at > 0 && c.share >= MIN_INK_SHARE)
    .sort((a, b) => b.share - a.share)
    .map((c) => c.at);
  if (inkIndexes.length === 0) return null;
  const inkShare = inkIndexes.reduce((sum, at) => sum + counts[at], 0) / total;
  return { input, rect, labels, palette, colours, groundHex: colours[0].screen ?? "#000000", inkIndexes, inkShare, regions: () => regionCount(labels, rect, LEAST_PATCH_PX) };
}

function sceneOf(r: Read, periodX: number | null, periodY: number | null): Scene {
  const { input } = r;
  return {
    flat: r.labels,
    rect: r.rect,
    palette: r.palette,
    ground: 0,
    groundHex: r.groundHex,
    originX: input.originMm.x,
    originY: input.originMm.y,
    step: input.stepMm,
    periodX,
    periodY,
    datum: input.datumMm,
    view: input.view === "back" ? "back" : "front",
  };
}

const inksFor = (r: Read, generator: PatternGenerator): string[] => r.inkIndexes.slice(0, generator.maxColours).map((at) => r.colours[at].screen ?? "#000000");

function clampParam(generator: PatternGenerator, id: string, value: number): number {
  const spec = generator.params.find((p) => p.id === id);
  return spec === undefined ? value : Math.min(spec.max, Math.max(spec.min, value));
}

/** Nudges each setting up and down, large steps first, keeping any change that lowers the error. */
function tune(scene: Scene, generator: PatternGenerator, candidate: Candidate, start: Trial, budget: MatchBudget): Trial {
  let best = start;
  for (const nudge of NUDGES) {
    for (const id of candidate.tune) {
      for (const sign of [1, -1]) {
        const current = best.params[id];
        if (typeof current !== "number") continue;
        const next = clampParam(generator, id, current * (1 + sign * nudge));
        if (next === current) continue;
        const tried = trial(scene, generator, { ...best.params, [id]: next }, best.inks, budget, candidate.seed, null);
        if (tried === null) return best;
        if (tried.error < best.error) best = tried;
      }
    }
  }
  return best;
}

interface Found {
  readonly trial: Trial;
  readonly candidate: Candidate;
  readonly generator: PatternGenerator;
}

function search(r: Read, scene: Scene, measured: Parameters<typeof candidatesFor>[0], options: StageOptions): Found | null {
  const lookup = options.lookup ?? getGenerator;
  let best: Found | null = null;
  for (const candidate of candidatesFor(measured)) {
    const generator = lookup(candidate.generatorId);
    if (generator === undefined) continue;
    const first = trial(scene, generator, candidate.start, inksFor(r, generator), options.budget, candidate.seed, null);
    if (first === null) break;
    if (best === null || first.error < best.trial.error) best = { trial: first, candidate, generator };
  }
  if (best === null) return null;
  const tuned = tune(scene, best.generator, best.candidate, best.trial, options.budget);
  return { ...best, trial: tuned };
}

const cutArea = (r: Read, widthPx: number, heightPx: number): PictureCut["area"] => {
  const { originMm, stepMm } = r.input;
  const [minX, minY] = [originMm.x + r.rect.x0 * stepMm, originMm.y + r.rect.y0 * stepMm];
  return { minX, minY, maxX: minX + widthPx * stepMm, maxY: minY + heightPx * stepMm };
};

/** A tile is one period; along an axis that does not repeat it is as tall as it is wide. */
function tileCut(r: Read, periodX: number | null, periodY: number | null): PictureCut {
  const side = Math.max(periodX ?? 0, periodY ?? 0);
  const w = Math.min(periodX ?? side, r.rect.x1 - r.rect.x0);
  const h = Math.min(periodY ?? side, r.rect.y1 - r.rect.y0);
  return cutOf(r.input.view, "tile", cutArea(r, w, h), false);
}

function panelCut(input: PatternInput): PictureCut {
  let [x0, y0, x1, y1] = [input.flat.width, input.flat.height, 0, 0];
  for (let at = 0; at < input.mask.length; at += 1) {
    if (input.mask[at] === 0) continue;
    const [x, y] = [at % input.flat.width, Math.floor(at / input.flat.width)];
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x + 1), Math.max(y1, y + 1)];
  }
  const { originMm, stepMm } = input;
  return cutOf(input.view, "panel", { minX: originMm.x + x0 * stepMm, minY: originMm.y + y0 * stepMm, maxX: originMm.x + x1 * stepMm, maxY: originMm.y + y1 * stepMm }, true);
}

/** W7b's seam check on one period, as a sentence. */
function seamNote(r: Read, cut: PictureCut): string {
  const { originMm, stepMm, flat } = r.input;
  const [x0, y0] = [Math.round((cut.area.minX - originMm.x) / stepMm), Math.round((cut.area.minY - originMm.y) / stepMm)];
  const [w, h] = [Math.round((cut.area.maxX - cut.area.minX) / stepMm), Math.round((cut.area.maxY - cut.area.minY) / stepMm)];
  const tile = crop(flat, { x0, y0, x1: x0 + w, y1: y0 + h });
  return seamReport({ data: new Uint8Array(tile.data.buffer, tile.data.byteOffset, tile.data.byteLength), width: tile.width, height: tile.height, channels: 4 }).verdict;
}

const sharpness = (input: PatternInput, cut: PictureCut): { dpi: number | null; warning: string | null } => {
  const widthMm = cut.area.maxX - cut.area.minX;
  const widthPx = Math.max(1, Math.min(MOST_TILE_PX, Math.round(widthMm * input.sourcePxPerMm)));
  return { dpi: effectiveDpi(widthPx, widthMm), warning: dpiWarning(widthPx, widthMm) };
};

export function createPatternStage(options: StageOptions): PatternStage {
  return {
    reads: true,
    async find(input) {
      const r = read(input);
      if (r === null) return null;
      return decide(r, options);
    },
  };
}

async function decide(r: Read, options: StageOptions): Promise<PatternProposal | null> {
  const { input } = r;
  const block = cropPixels(r);
  const repeat = await findRepeat(block);
  const [periodX, periodY] = [repeat.periodX, repeat.periodY];
  if (periodX === null && periodY === null) return r.regions() >= BUSY_REGIONS ? panelProposal(r) : null;
  const placed: Placed = { view: input.view, step: input.stepMm, colours: input.colours };
  const measured = { xMm: periodX === null ? null : periodX * input.stepMm, yMm: periodY === null ? null : periodY * input.stepMm, inkShare: r.inkShare, inks: r.inkIndexes.length };
  const found = search(r, sceneOf(r, periodX, periodY), measured, options);
  const sure = Math.min(...[periodX === null ? null : repeat.confidenceX, periodY === null ? null : repeat.confidenceY].filter((v): v is number => v !== null));
  const estimate = repeatOf(measured.xMm, measured.yMm);
  const cut = tileCut(r, periodX, periodY);
  const match: MatchSummary = { generatorId: found?.generator.id ?? null, error: found === null ? null : round2(found.trial.error), limit: ERROR_LIMIT };
  const used = options.budget.spent();
  const stopped = used.stoppedEarly ? " Matching stopped at its limit, so a closer style may have gone untried." : "";
  const tile = pictureLayer(placed, { id: layerIds(input.view).main, name: "All-over pattern: repeating picture", cut, mode: "tile", opacity: 1 });
  const sharp = sharpness(input, cut);
  const seam = seamNote(r, cut);
  if (found !== null && found.trial.error <= ERROR_LIMIT) {
    return generatorProposal({ r, placed, found, sure, estimate, cut, match, stopped, seam, sharp });
  }
  const closest = found === null ? "None of our styles could be read from this repeat." : `The closest of our styles, ${found.generator.label}, differed on about ${percent(found.trial.error)} of the pixels, over the ${percent(ERROR_LIMIT)} limit.`;
  return {
    layer: tile,
    kind: "tile",
    confidence: round2(clamp01(sure * 0.8)),
    note: `Kept as a repeating picture cut from yours. ${closest} ${repeatSentence(estimate)} ${seam}${stopped}`,
    repeat: estimate,
    alternative: null,
    cuts: [cut],
    effectiveDpi: sharp.dpi,
    dpiWarning: sharp.warning,
    match,
  };
}

function cropPixels(r: Read) {
  const block = crop(r.input.flat, r.rect);
  return { data: new Uint8Array(block.data.buffer, block.data.byteOffset, block.data.byteLength), width: block.width, height: block.height, channels: 4 as const };
}

function generatorProposal(c: {
  r: Read;
  placed: Placed;
  found: Found;
  sure: number;
  estimate: ReturnType<typeof repeatOf>;
  cut: PictureCut;
  match: MatchSummary;
  stopped: string;
  seam: string;
  sharp: { dpi: number | null; warning: string | null };
}): PatternProposal {
  const { r, placed, found } = c;
  const view: ViewId = r.input.view;
  const inkIds = r.inkIndexes.slice(0, found.generator.maxColours).map((at) => r.colours[at].id);
  const layer: Layer = generatorLayer(placed, {
    generatorId: found.generator.id,
    params: found.trial.params,
    inkIds,
    shift: found.trial.shift,
    movesWithDatum: found.candidate.movesWithDatum,
    label: found.generator.label,
  });
  const alternative = pictureLayer(placed, { id: layerIds(view).alternative, name: "Alternative: your pattern kept as a repeating picture", cut: { ...c.cut, assetId: `tile-${view}` }, mode: "tile", opacity: 0 });
  const start = found.candidate.movesWithDatum ? "Where the pattern starts is read from the picture." : "Where the first row starts follows the pattern piece, so check the rows against your picture.";
  return {
    layer,
    kind: "generator",
    confidence: round2(clamp01(c.sure * (1 - (0.5 * found.trial.error) / ERROR_LIMIT))),
    note: `Looks like ${found.generator.label} from our list: about ${percent(found.trial.error)} of the pixels in a block of the garment differ from its drawing, under the ${percent(ERROR_LIMIT)} limit. ${repeatSentence(c.estimate)} ${start} The repeating picture is kept as the alternative, not drawn until you choose it. ${c.seam}${c.stopped}`,
    repeat: c.estimate,
    alternative,
    cuts: [c.cut],
    effectiveDpi: c.sharp.dpi,
    dpiWarning: c.sharp.warning,
    match: c.match,
  };
}

function panelProposal(r: Read): PatternProposal {
  const { input } = r;
  const placed: Placed = { view: input.view, step: input.stepMm, colours: input.colours };
  const cut = panelCut(input);
  const sharp = sharpness(input, cut);
  return {
    layer: pictureLayer(placed, { id: layerIds(input.view).main, name: "Full-panel picture", cut, mode: "panel", opacity: 1 }),
    kind: "panel",
    confidence: 0.4,
    note: "No repeat was found, so this view is kept as one full-panel picture cut from yours.",
    repeat: null,
    alternative: null,
    cuts: [cut],
    effectiveDpi: sharp.dpi,
    dpiWarning: sharp.warning,
    match: { generatorId: null, error: null, limit: ERROR_LIMIT },
  };
}

export const MATCH_BUDGET_SENTENCE = budgetSentence(MATCH_LIMITS);
