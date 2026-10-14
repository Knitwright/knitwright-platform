import { panelColourId, type GroundLayer, type Layer, type PatternLayer } from "@/lib/artwork-stack";
import { offsetOutline } from "@/lib/production/geometry/offset";
import { subtractRegions, type Shape } from "../geometry/boolean";
import { boundsOf, growBox, type Pt } from "../geometry/vec";
import { fileDpiFor, pixelGrid } from "../raster/grid";
import { keepClearFilled } from "./clear-space";
import { screenColour, stackIsFromPicture, type BuildEnv, type PieceRequest } from "./context";
import { flattenLayers, layerNeedingPixels } from "./flatten";
import { rasteriseImageSet, paintable } from "./images";
import { planImageFill } from "./image-fill";
import { clearRegion, type MarkPlan } from "./marks";
import { planGraphic } from "./mark-graphic";
import { planPlayerMark, planText } from "./mark-text";
import { marginNotes } from "./notes";
import { buildPatternShapes } from "./pattern";
import { agreementNotes } from "./seam-notes";
import { createPrintSpace, type PrintSpace } from "./print-space";
import type { FilledShape, Issue, PieceScene, RasterLayer, SceneLayer } from "./scene";

const FALLBACK_GROUND = "#ffffff";

/** The colour a view is printed on: its ground layer's, else the panel colour the older fields kept, else unprinted white. */
function groundFor(env: BuildEnv, layers: readonly Layer[], view: string, issues: Issue[]): { hex: string; layer: GroundLayer | null } {
  const layer = layers.find((l): l is GroundLayer => l.kind === "ground") ?? null;
  const id = layer?.colourId ?? [panelColourId(`body-${view}`), panelColourId(view)].find((c) => env.stack.colours.some((e) => e.id === c));
  const hex = screenColour(env, id);
  if (hex === null) {
    issues.push({ code: "no-ground", text: "This piece has no ground colour, so it is left unprinted (white fabric)." });
    return { hex: FALLBACK_GROUND, layer };
  }
  return { hex, layer };
}

const polyOf = (shapes: readonly FilledShape[]): Pt[][] => shapes.flatMap((s) => s.shape.map((ring) => [...ring]));

interface Pass {
  readonly env: BuildEnv;
  readonly req: PieceRequest;
  readonly space: PrintSpace;
  readonly bleedOutline: readonly Pt[];
  readonly plans: readonly MarkPlan[];
}

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

async function planMarks(env: BuildEnv, req: PieceRequest, space: PrintSpace, layers: readonly Layer[]): Promise<MarkPlan[]> {
  const plans: MarkPlan[] = [];
  for (const [index, layer] of layers.entries()) {
    const where = { view: req.view, size: req.size, space, index };
    if (layer.kind === "graphic") plans.push(await planGraphic(env, layer, where));
    else if (layer.kind === "text") plans.push(await planText(env, layer, where));
    else if (layer.kind === "player-mark") plans.push(await planPlayerMark(env, layer, where, req.player));
  }
  return plans;
}

interface Built {
  readonly layers: SceneLayer[];
  readonly issues: Issue[];
  readonly notes: string[];
  readonly lowestDpi: number | null;
}

async function paintLayers(pass: Pass, layers: readonly Layer[], ground: { hex: string; layer: GroundLayer | null }, box: ReturnType<typeof growBox>, grid: ReturnType<typeof pixelGrid>): Promise<Built> {
  const { env, req, space, bleedOutline } = pass;
  const out: SceneLayer[] = [];
  const issues: Issue[] = [];
  const notes: string[] = [];
  const dpis: number[] = [];
  if (ground.layer === null && req.transferOnly !== true) out.push({ kind: "vector", layerId: "ground", opacity: 1, blend: "normal", shapes: [{ fill: ground.hex, shape: [bleedOutline] as Shape }] });
  for (const [index, layer] of layers.entries()) {
    const above = regionsAbove(pass, index, 0);
    if (layer.kind === "ground") {
      if (req.transferOnly === true) continue;
      const shape = subtractRegions([[bleedOutline]], above.knock)[0] ?? [];
      out.push({ kind: "vector", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, shapes: [{ fill: ground.hex, shape }] });
    } else if (layer.kind === "pattern") {
      const marginMm = typeof layer.params.clearSpaceMm === "number" ? layer.params.clearSpaceMm : 0;
      const regions = regionsAbove(pass, index, marginMm);
      const built = buildPatternShapes({ env, layer: layer as PatternLayer, space, view: req.view, size: req.size, bleedOutline, ground: ground.hex });
      issues.push(...built.issues);
      notes.push(...built.notes);
      const kept = keepClearFilled(built.shapes, regions.clear);
      const holed = regions.knock.length === 0 ? kept : kept.map((s) => ({ ...s, shape: subtractRegions([s.shape], regions.knock)[0] ?? [] })).filter((s) => s.shape.length > 0);
      if (layer.blend !== "knock-out") out.push({ kind: "vector", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, shapes: holed });
    } else if (layer.kind === "image-fill") {
      const regions = regionsAbove(pass, index, 0);
      const plan = await planImageFill({ env, layer, view: req.view, size: req.size, space, bleedOutline });
      issues.push(...plan.issues);
      notes.push(...plan.notes);
      if (plan.lowestDpi !== null) dpis.push(plan.lowestDpi);
      if (plan.set !== null) {
        const strips = await rasteriseImageSet(plan.set, paintable(bleedOutline, [...regions.clear, ...regions.knock]), box, grid);
        out.push({ kind: "raster", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, dpi: grid.dpi, strips });
      }
    } else {
      const plan = pass.plans.find((p) => p.index === index);
      if (plan === undefined) continue;
      issues.push(...plan.issues);
      notes.push(...plan.notes);
      if (plan.lowestDpi !== null) dpis.push(plan.lowestDpi);
      const holes = regionsAbove(pass, index, 0).knock;
      if (plan.paintsNothing) continue;
      if (plan.shapes.length > 0) {
        const shapes = plan.shapes.map((s) => ({ ...s, shape: subtractRegions([s.shape], holes)[0] ?? [] })).filter((s) => s.shape.length > 0);
        out.push({ kind: "vector", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, shapes });
      }
      if (plan.images !== null) {
        const strips = await rasteriseImageSet(plan.images, paintable(bleedOutline, holes), box, grid);
        out.push({ kind: "raster", layerId: layer.id, opacity: layer.opacity, blend: layer.blend, dpi: grid.dpi, strips });
      }
    }
  }
  return { layers: out, issues, notes, lowestDpi: dpis.length === 0 ? null : Math.min(...dpis) };
}

/**
 * One piece, one size, one player, as a scene any renderer can draw. The piece is opened if it was cut on the fold; the
 * artwork is read from the design plane, so it is never mirrored. Layers are built one kind at a time in the stack's blend
 * order, and the result is the same for every design: this function never asks what made the stack.
 */
export async function buildPieceScene(env: BuildEnv, req: PieceRequest): Promise<PieceScene | null> {
  const space = createPrintSpace(env.mapper, req.view, req.size, env.scale);
  if (space === null) return null;
  const bleedMm = env.settings.bleedMm;
  const cutOutline = space.outline;
  const bleedOutline = bleedMm > 0 ? offsetOutline(cutOutline, bleedMm) : cutOutline;
  const box = growBox(boundsOf(cutOutline), bleedMm);
  const resolution = fileDpiFor(box, env.settings.dpi);
  const sized: BuildEnv = { ...env, settings: { ...env.settings, dpi: resolution.dpi } };
  const grid = pixelGrid(box, resolution.dpi);
  const layers = env.stack.layers.filter((l) => l.views.includes(req.view) && (req.transferOnly !== true || l.kind === "player-mark"));
  const issues: Issue[] = [];
  const ground = groundFor(sized, layers, req.view, issues);
  const plans = await planMarks(sized, req, space, layers);
  const pass: Pass = { env: sized, req, space, bleedOutline, plans };
  const built = await paintLayers(pass, layers, ground, box, grid);
  issues.push(...built.issues);
  const pieceName = env.mapper.frame(req.view, req.size)?.opened.piece.name ?? req.view;
  if (resolution.lowered) issues.push({ code: "dpi-lowered", text: `Resolution lowered to ${resolution.dpi} dpi because this piece would have too many pixels.` });
  const base: PieceScene = {
    pieceId: space.frame.pieceId,
    pieceName,
    view: req.view,
    size: req.size,
    sizeLabel: req.sizeLabel ?? null,
    player: req.player ?? null,
    cutOutline,
    bleedOutline,
    box,
    bleedMm,
    dpi: resolution.dpi,
    scale: { length: env.scale.length, width: env.scale.width },
    layers: built.layers,
    notes: [],
    issues,
    lowestDpi: built.lowestDpi,
    flattened: false,
    transferOnly: req.transferOnly === true,
  };
  const pixels = layerNeedingPixels(built.layers);
  const layersOut = pixels === null ? built.layers : [await flattenLayers(base, grid)];
  const flattenedBy = pixels === null ? null : `${pixels.layerId} mixes with the layers under it (${pixels.blend})`;
  const notes = marginNotes({
    env: sized,
    req,
    pieceName,
    lowestDpi: built.lowestDpi,
    dpi: resolution.dpi,
    dpiLowered: resolution.lowered,
    flattenedBy,
    fromPicture: stackIsFromPicture(env.stack),
    agreement: agreementNotes(env, layers, req),
    extra: built.notes,
    issues: base.issues.filter((i) => i.code !== "dpi-lowered"),
  });
  return { ...base, layers: layersOut, flattened: pixels !== null, notes };
}

export type { RasterLayer };
