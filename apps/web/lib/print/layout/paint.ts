import type { GroundLayer, Layer, PatternLayer } from "@/lib/artwork-stack";
import { subtractRegions, type Shape } from "../geometry/boolean";
import type { Pt } from "../geometry/vec";
import type { pixelGrid } from "../raster/grid";
import { keepClearFilled } from "./clear-space";
import type { BuildEnv, PieceRequest } from "./context";
import { planImageFill } from "./image-fill";
import { paintable, rasteriseImageSet } from "./images";
import { clearRegion, type MarkPlan } from "./marks";
import { planGraphic } from "./mark-graphic";
import { planPlayerMark, planText } from "./mark-text";
import { buildPatternShapes } from "./pattern";
import type { PrintSpace } from "./print-space";
import type { FilledShape, Issue, SceneLayer } from "./scene";

type Grid = ReturnType<typeof pixelGrid>;
type Box = { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };

export interface Pass {
  readonly env: BuildEnv;
  readonly req: PieceRequest;
  readonly space: PrintSpace;
  readonly bleedOutline: readonly Pt[];
  readonly plans: readonly MarkPlan[];
}

const polyOf = (shapes: readonly FilledShape[]): Pt[][] => shapes.flatMap((s) => s.shape.map((ring) => [...ring]));

/** Regions the layer at `index` must keep clear of: marks above it that cut, and holes that knock it out. */
function regionsAbove(pass: Pass, index: number, extraMm: number): { clear: Pt[][]; knock: Pt[][] } {
  const clear: Pt[][] = [];
  const knock: Pt[][] = [];
  for (const plan of pass.plans.filter((p) => p.index > index)) {
    if (plan.paintsNothing) knock.push(...polyOf(plan.shapes));
    const region = clearRegion(plan, extraMm, pass.space);
    if (region !== null && (plan.cuts || extraMm > 0)) clear.push(region);
  }
  return { clear, knock };
}

export async function planMarks(env: BuildEnv, req: PieceRequest, space: PrintSpace, layers: readonly Layer[]): Promise<MarkPlan[]> {
  const plans: MarkPlan[] = [];
  for (const [index, layer] of layers.entries()) {
    const where = { view: req.view, size: req.size, space, index };
    if (layer.kind === "graphic") plans.push(await planGraphic(env, layer, where));
    else if (layer.kind === "text") plans.push(await planText(env, layer, where));
    else if (layer.kind === "player-mark") plans.push(await planPlayerMark(env, layer, where, req.player));
  }
  return plans;
}

export interface Built {
  readonly layers: SceneLayer[];
  readonly issues: Issue[];
  readonly notes: string[];
  readonly lowestDpi: number | null;
}

interface Sink {
  readonly layers: SceneLayer[];
  readonly issues: Issue[];
  readonly notes: string[];
  readonly dpis: number[];
}

export interface Ground {
  readonly hex: string;
  readonly layer: GroundLayer | null;
}

interface Page {
  readonly box: Box;
  readonly grid: Grid;
}

const vector = (layer: Layer, shapes: readonly FilledShape[]): SceneLayer => ({ kind: "vector", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, shapes });
const raster = (layer: Layer, page: Page, strips: Awaited<ReturnType<typeof rasteriseImageSet>>): SceneLayer => ({ kind: "raster", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, dpi: page.grid.dpi, strips });

const withoutHoles = (shapes: readonly FilledShape[], holes: readonly Pt[][]): FilledShape[] =>
  holes.length === 0 ? [...shapes] : shapes.map((s) => ({ ...s, shape: subtractRegions([s.shape], holes)[0] ?? [] })).filter((s) => s.shape.length > 0);

function paintGround(pass: Pass, layer: GroundLayer, ground: Ground, index: number, sink: Sink): void {
  if (pass.req.transferOnly === true) return;
  const shape = subtractRegions([[pass.bleedOutline]], regionsAbove(pass, index, 0).knock)[0] ?? [];
  sink.layers.push(vector(layer, [{ fill: ground.hex, shape }]));
}

function paintPattern(pass: Pass, layer: PatternLayer, ground: Ground, index: number, sink: Sink): void {
  const marginMm = typeof layer.params.clearSpaceMm === "number" ? layer.params.clearSpaceMm : 0;
  const regions = regionsAbove(pass, index, marginMm);
  const built = buildPatternShapes({ env: pass.env, layer, space: pass.space, view: pass.req.view, size: pass.req.size, bleedOutline: pass.bleedOutline, ground: ground.hex });
  sink.issues.push(...built.issues);
  sink.notes.push(...built.notes);
  if (layer.blend !== "knock-out") sink.layers.push(vector(layer, withoutHoles(keepClearFilled(built.shapes, regions.clear), regions.knock)));
}

async function paintFill(pass: Pass, layer: Extract<Layer, { kind: "image-fill" }>, page: Page, index: number, sink: Sink): Promise<void> {
  const regions = regionsAbove(pass, index, 0);
  const plan = await planImageFill({ env: pass.env, layer, view: pass.req.view, size: pass.req.size, space: pass.space, bleedOutline: pass.bleedOutline });
  sink.issues.push(...plan.issues);
  sink.notes.push(...plan.notes);
  if (plan.lowestDpi !== null) sink.dpis.push(plan.lowestDpi);
  if (plan.set !== null) {
    sink.layers.push(raster(layer, page, await rasteriseImageSet(plan.set, paintable(pass.bleedOutline, [...regions.clear, ...regions.knock]), page.box, page.grid)));
  }
}

async function paintMark(pass: Pass, layer: Layer, page: Page, index: number, sink: Sink): Promise<void> {
  const plan = pass.plans.find((p) => p.index === index);
  if (plan === undefined) return;
  sink.issues.push(...plan.issues);
  sink.notes.push(...plan.notes);
  if (plan.lowestDpi !== null) sink.dpis.push(plan.lowestDpi);
  const holes = regionsAbove(pass, index, 0).knock;
  if (plan.paintsNothing) return;
  if (plan.shapes.length > 0) sink.layers.push(vector(layer, withoutHoles(plan.shapes, holes)));
  if (plan.images !== null) sink.layers.push(raster(layer, page, await rasteriseImageSet(plan.images, paintable(pass.bleedOutline, holes), page.box, page.grid)));
}

/** Paints the stack's layers for one piece, bottom to top, each kind its own way. */
export async function paintLayers(pass: Pass, layers: readonly Layer[], ground: Ground, box: Box, grid: Grid): Promise<Built> {
  const sink: Sink = { layers: [], issues: [], notes: [], dpis: [] };
  const page: Page = { box, grid };
  if (ground.layer === null && pass.req.transferOnly !== true) sink.layers.push({ kind: "vector", layerId: "ground", opacity: 1, blend: "normal", shapes: [{ fill: ground.hex, shape: [pass.bleedOutline] as Shape }] });
  for (const [index, layer] of layers.entries()) {
    if (layer.kind === "ground") paintGround(pass, layer, ground, index, sink);
    else if (layer.kind === "pattern") paintPattern(pass, layer, ground, index, sink);
    else if (layer.kind === "image-fill") await paintFill(pass, layer, page, index, sink);
    else await paintMark(pass, layer, page, index, sink);
  }
  return { layers: sink.layers, issues: sink.issues, notes: sink.notes, lowestDpi: sink.dpis.length === 0 ? null : Math.min(...sink.dpis) };
}
