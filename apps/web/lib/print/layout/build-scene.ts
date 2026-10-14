import { blendNeedsRaster, type Layer } from "@/lib/artwork-stack";
import { applyAll, compose, invert, scaling, type Affine, type Pt } from "../geometry/affine";
import { growRing, intersectRings, subtractRings } from "../geometry/clip";
import { boundsOf, boxesOverlap } from "../geometry/polygon";
import { avoidedColours } from "../rules/colour";
import { avoidIssues } from "../rules/checks";
import type { Box, PieceScene, PrintIssue, Ring, SceneItem } from "../scene";
import { screenColour } from "./colours";
import { groundLayer } from "./layers/ground";
import { graphicLayer } from "./layers/graphic";
import { imageFillLayer } from "./layers/image-fill";
import { patternLayer } from "./layers/pattern";
import { playerMarkLayer, textLayer } from "./layers/text";
import { marginItems, noteLines } from "./margin";
import type { Built, LayerResult, LayerSpace, LayoutInput, PlacedMark } from "./types";

export interface BuiltScene {
  readonly scene: PieceScene;
  readonly marks: readonly PlacedMark[];
  /** The lowest dots per inch of any picture on the piece, or null when it has none. */
  readonly lowestDpi: number | null;
}

const CARVED: ReadonlySet<Built["kind"]> = new Set(["pattern", "image-fill"]);

/** Clears regions out of the pattern and picture layers already drawn. The ground is never touched. */
function carve(built: readonly Built[], regions: readonly Ring[], visible: Ring): Built[] {
  if (regions.length === 0) return [...built];
  const holes = regions.map((ring) => ring);
  const box = boundsOf(holes.flat());
  return built.flatMap((entry): Built[] => {
    const { item } = entry;
    if (!CARVED.has(entry.kind) || item.kind === "stroke") return [entry];
    if (item.kind === "image") {
      const inside = intersectRings(holes, [visible]);
      return [{ ...entry, item: { ...item, clip: [...item.clip, ...inside] } }];
    }
    if (!boxesOverlap(boundsOf(item.rings.flat()), box)) return [entry];
    const rings = subtractRings(item.rings, holes);
    return rings.length === 0 ? [] : [{ ...entry, item: { ...item, rings } }];
  });
}

async function runLayer(layer: Layer, space: LayerSpace, under: string): Promise<LayerResult> {
  switch (layer.kind) {
    case "ground":
      return groundLayer(layer, space);
    case "pattern":
      return patternLayer(layer, space, under);
    case "image-fill":
      return imageFillLayer(layer, space);
    case "graphic":
      return graphicLayer(layer, space);
    case "text":
      return textLayer(layer, space);
    case "player-mark":
      return playerMarkLayer(layer, space);
  }
}

const isTransfer = (layer: Layer): boolean => layer.technique === "transfer" && layer.kind !== "ground" && layer.kind !== "pattern" && layer.kind !== "image-fill";

/** A layer that blends as a knock-out draws nothing: its shapes are holes in what lies under it. */
function asHole(result: LayerResult): LayerResult {
  const rings = result.built.flatMap((entry) => (entry.item.kind === "fill" ? entry.item.rings : []));
  return { ...result, built: [], knock: [...result.knock, ...rings] };
}

function scaleItem(item: SceneItem, matrix: Affine, bleed: Ring, mean: number): SceneItem {
  switch (item.kind) {
    case "fill":
      return { ...item, rings: item.rings.map((ring) => applyAll(matrix, ring)) };
    case "stroke":
      return { ...item, points: applyAll(matrix, item.points), widthMm: item.widthMm * mean };
    case "image":
      return { ...item, matrix: compose(matrix, item.matrix), clip: [bleed, ...item.clip.slice(1).map((ring) => applyAll(matrix, ring))] };
  }
}

function dedupe(issues: readonly PrintIssue[]): PrintIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => !seen.has(issue.text) && seen.add(issue.text));
}

const boxOf = (ring: Ring): Box => boundsOf(ring as readonly Pt[]);

/** One piece for one size (and one player), as a scene: layers built in stack order, scaled for shrink, with bleed and a margin note. */
export async function buildPieceScene(input: LayoutInput): Promise<BuiltScene> {
  const { instance, frame, settings, stack } = input;
  const matrix = scaling(settings.scaleX, settings.scaleY);
  const cut = applyAll(matrix, instance.opened);
  const bleed = settings.bleedMm > 0 ? growRing(cut, settings.bleedMm) : cut;
  const visible = applyAll(invert(matrix), bleed);
  const underarm = input.anchors.underarm ?? input.anchors["underarm-a"];
  const space: LayerSpace = { input, visible, visibleBox: boxOf(visible), toPiece: frame.toPiece, toDesign: frame.toDesign, chestY: underarm?.y ?? 0 };
  const layers = stack.layers.filter((layer) => layer.views.includes(instance.view) && (!input.transferOnly || isTransfer(layer)));
  const rasterLayer = layers.find((layer) => blendNeedsRaster(layer.blend));
  let built: Built[] = [];
  let under = "#ffffff";
  const issues: PrintIssue[] = [];
  const colours: string[] = [];
  const dpis: number[] = [];
  const marks: PlacedMark[] = [];
  for (const layer of layers) {
    const raw = await runLayer(layer, space, under);
    const result = layer.blend === "knock-out" ? asHole(raw) : raw;
    built = [...carve(built, result.knock, visible), ...result.built];
    if (layer.kind === "ground") under = screenColour(stack, input.colourwayId, layer.colourId).hex;
    issues.push(...result.issues);
    colours.push(...result.colours);
    dpis.push(...result.dpis);
    marks.push(...(result.marks ?? []));
  }
  const rules = input.rules;
  issues.push(...avoidIssues(avoidedColours(colours, rules.coloursToAvoid)));
  if (rules.coloursToAvoid.length === 0) issues.push({ severity: "note", text: "No colours to avoid are set, so no colour was checked against a list." });
  const lowestDpi = dpis.length === 0 ? null : Math.min(...dpis);
  const all = dedupe(issues);
  const mean = Math.sqrt(settings.scaleX * settings.scaleY);
  const cutBox = boxOf(cut);
  const player = input.player ? `${input.player.name === "" ? "" : `${input.player.name} `}${input.player.number}`.trim() : null;
  const rasterReason = rasterLayer ? `Layer ${rasterLayer.id} blends with the layers under it, so this piece is built as one picture.` : null;
  const lines = noteLines({
    pieceName: instance.pieceName,
    size: instance.size,
    player,
    scaleX: settings.scaleX,
    scaleY: settings.scaleY,
    scaleNote: settings.scaleNote,
    defaultsNote: settings.defaultsNote,
    lowestDpi,
    patternReviewed: settings.patternReviewed,
    readFromPicture: stack.layers.some((layer) => layer.provenance === "read-from-image"),
    rasterReason,
    issues: all,
    playerNote: input.player || !layers.some((l) => l.kind === "player-mark") ? null : "Names and numbers are in the player files.",
  });
  const scene: PieceScene = {
    instanceId: instance.id,
    pieceName: instance.pieceName,
    size: instance.size,
    playerLabel: player,
    cut,
    bleed,
    bleedMm: settings.bleedMm,
    cutBox,
    dpi: settings.dpi,
    items: built.map((entry) => scaleItem(entry.item, matrix, bleed, mean)),
    margin: marginItems(lines, cutBox, settings.bleedMm),
    raster: rasterReason ? { reason: rasterReason } : null,
    noteLines: lines,
    issues: all,
  };
  return { scene, marks, lowestDpi };
}
