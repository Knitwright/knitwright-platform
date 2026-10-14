import { panelColourId, type GroundLayer, type Layer } from "@/lib/artwork-stack";
import { offsetOutline } from "@/lib/production/geometry/offset";
import { boundsOf, growBox } from "../geometry/vec";
import { fileDpiFor, pixelGrid } from "../raster/grid";
import { screenColour, stackIsFromPicture, type BuildEnv, type PieceRequest } from "./context";
import { flattenLayers, layerNeedingPixels } from "./flatten";
import { marginNotes } from "./notes";
import { paintLayers, planMarks, type Ground, type Pass } from "./paint";
import { agreementNotes } from "./seam-notes";
import { createPrintSpace } from "./print-space";
import type { Issue, PieceScene } from "./scene";

const FALLBACK_GROUND = "#ffffff";

/** The colour a view is printed on: its ground layer's, else the panel colour the older fields kept, else unprinted white. */
function groundFor(env: BuildEnv, layers: readonly Layer[], view: string, issues: Issue[]): Ground {
  const layer = layers.find((l): l is GroundLayer => l.kind === "ground") ?? null;
  const id = layer?.colourId ?? [panelColourId(`body-${view}`), panelColourId(view)].find((c) => env.stack.colours.some((e) => e.id === c));
  const hex = screenColour(env, id);
  if (hex === null) {
    issues.push({ code: "no-ground", text: "This piece has no ground colour, so it is left unprinted (white fabric)." });
    return { hex: FALLBACK_GROUND, layer };
  }
  return { hex, layer };
}

interface Geometry {
  readonly space: NonNullable<ReturnType<typeof createPrintSpace>>;
  readonly bleedOutline: PieceScene["bleedOutline"];
  readonly box: PieceScene["box"];
  readonly resolution: ReturnType<typeof fileDpiFor>;
  readonly grid: ReturnType<typeof pixelGrid>;
}

function geometryOf(env: BuildEnv, req: PieceRequest): Geometry | null {
  const space = createPrintSpace(env.mapper, req.view, req.size, env.scale);
  if (space === null) return null;
  const bleedMm = env.settings.bleedMm;
  const bleedOutline = bleedMm > 0 ? offsetOutline(space.outline, bleedMm) : space.outline;
  const box = growBox(boundsOf(space.outline), bleedMm);
  const resolution = fileDpiFor(box, env.settings.dpi);
  return { space, bleedOutline, box, resolution, grid: pixelGrid(box, resolution.dpi) };
}

/** The scene with its layers turned to pixels when a blend needs it, and the margin notes written. */
async function finish(env: BuildEnv, req: PieceRequest, geo: Geometry, base: PieceScene, layers: readonly Layer[], extra: readonly string[]): Promise<PieceScene> {
  const pixels = layerNeedingPixels(base.layers);
  const layersOut = pixels === null ? base.layers : [await flattenLayers(base, geo.grid)];
  const notes = marginNotes({
    env,
    req,
    pieceName: base.pieceName,
    lowestDpi: base.lowestDpi,
    dpi: geo.resolution.dpi,
    dpiLowered: geo.resolution.lowered,
    flattenedBy: pixels === null ? null : `${pixels.layerId} mixes with the layers under it (${pixels.blend})`,
    fromPicture: stackIsFromPicture(env.stack),
    agreement: agreementNotes(env, layers, req),
    extra,
    issues: base.issues.filter((i) => i.code !== "dpi-lowered"),
  });
  return { ...base, layers: layersOut, flattened: pixels !== null, notes };
}

/**
 * One piece, one size, one player, as a scene any renderer can draw. The piece is opened if it was cut on the fold; the
 * artwork is read from the design plane, so it is never mirrored. Layers are built one kind at a time in the stack's blend
 * order, and the result is the same for every design: this function never asks what made the stack.
 */
export async function buildPieceScene(env: BuildEnv, req: PieceRequest): Promise<PieceScene | null> {
  const geo = geometryOf(env, req);
  if (geo === null) return null;
  const { space, bleedOutline, box, resolution, grid } = geo;
  const sized: BuildEnv = { ...env, settings: { ...env.settings, dpi: resolution.dpi } };
  const layers = env.stack.layers.filter((l) => l.views.includes(req.view) && (req.transferOnly !== true || l.kind === "player-mark"));
  const issues: Issue[] = [];
  const ground = groundFor(sized, layers, req.view, issues);
  const pass: Pass = { env: sized, req, space, bleedOutline, plans: await planMarks(sized, req, space, layers) };
  const built = await paintLayers(pass, layers, ground, box, grid);
  issues.push(...built.issues);
  if (resolution.lowered) issues.push({ code: "dpi-lowered", text: `Resolution lowered to ${resolution.dpi} dpi because this piece would have too many pixels.` });
  const base: PieceScene = {
    pieceId: space.frame.pieceId,
    pieceName: space.frame.opened.piece.name,
    view: req.view,
    size: req.size,
    sizeLabel: req.sizeLabel ?? null,
    player: req.player ?? null,
    cutOutline: space.outline,
    bleedOutline,
    box,
    bleedMm: env.settings.bleedMm,
    dpi: resolution.dpi,
    scale: { length: env.scale.length, width: env.scale.width },
    layers: built.layers,
    notes: [],
    issues,
    lowestDpi: built.lowestDpi,
    flattened: false,
    transferOnly: req.transferOnly === true,
  };
  return finish(env, req, geo, base, layers, built.notes);
}
