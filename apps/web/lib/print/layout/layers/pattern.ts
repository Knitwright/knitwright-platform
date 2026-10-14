import { resolveDatum, type DisplayShape, type PatternLayer, type PointMm } from "@/lib/artwork-stack";
import { applyAll, type Pt } from "../../geometry/affine";
import { boundsOf, boxesOverlap, circleRing } from "../../geometry/polygon";
import type { FillItem, PrintIssue, Ring } from "../../scene";
import { screenColour, screenColours } from "../colours";
import type { LayerResult, LayerSpace } from "../types";
import { isSound } from "../field";

/** The most shapes one pattern layer may add to one piece. Over it, the layer is left off and said so. */
export const SHAPE_BUDGET = 60_000;

const stopped = (text: string): LayerResult => ({ built: [], knock: [], colours: [], dpis: [], issues: [{ severity: "stop", text }] });

const mmPoint = ([x, y]: Pt): PointMm => ({ x, y });

function ringOf(shape: DisplayShape): Ring {
  return shape.kind === "polygon" ? shape.points.map((p): Pt => [p.x, p.y]) : circleRing([shape.centre.x, shape.centre.y], shape.radius);
}

/**
 * A parametric pattern: the generator draws over the piece's bounds plus bleed on the view's shared datum,
 * so every piece of every size reads the same field. Its shapes are moved onto the piece by the frame.
 */
export function patternLayer(layer: PatternLayer, space: LayerSpace, underBase: string): LayerResult {
  const { input } = space;
  const generator = input.generators.find((entry) => entry.id === layer.generatorId);
  if (!generator) {
    return stopped(`The pattern "${layer.generatorId}" is not available, so it was left off.`);
  }
  const box = input.field;
  if (!isSound(box)) return stopped(`The area for the pattern "${generator.label}" could not be worked out on this piece, so it was left off.`);
  const frame: Pt[] = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]];
  // The older styles want the underarm on the right of the page, whichever side the piece lies on.
  const anchors = input.anchors.underarm ? { ...input.anchors, underarm: { x: Math.abs(input.anchors.underarm.x), y: input.anchors.underarm.y } } : input.anchors;
  const inks = screenColours(input.stack, input.colourwayId, layer.colourIds);
  const list = generator.render({
    view: input.instance.view,
    bounds: box,
    clip: frame.map(mmPoint),
    landmarks: anchors,
    datum: resolveDatum(layer.datum, anchors.underarm ?? anchors["underarm-a"]),
    colours: inks.hexes,
    ground: underBase,
    params: layer.params,
    seed: layer.seed ?? 0,
  });
  const issues: PrintIssue[] = [...inks.issues];
  if (list.note) issues.push({ severity: "note", text: list.note });
  if (list.shapes.length > SHAPE_BUDGET) {
    issues.push({ severity: "stop", text: `The pattern "${generator.label}" would need more than ${SHAPE_BUDGET} shapes on this piece, so it was left off. Make the pattern larger.` });
    return { built: [], knock: [], colours: inks.hexes, dpis: [], issues };
  }
  const built = list.shapes.flatMap((shape) => {
    const ring = applyAll(space.toPiece, ringOf(shape));
    if (!boxesOverlap(boundsOf(ring), space.visibleBox)) return [];
    const item: FillItem = { kind: "fill", layerId: layer.id, rings: [ring], colour: fillOf(shape.fill, input.stack, input.colourwayId), opacity: layer.opacity, blend: layer.blend };
    return [{ item, kind: "pattern" as const }];
  });
  return { built, knock: [], issues, colours: inks.hexes, dpis: [] };
}

const fillOf = (fill: string, stack: LayerSpace["input"]["stack"], colourwayId: string): string => (/^#[0-9a-fA-F]{6}$/.test(fill) ? fill.toLowerCase() : screenColour(stack, colourwayId, fill).hex);
