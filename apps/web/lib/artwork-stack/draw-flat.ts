import { tidy } from "@/lib/flat/chain";
import { safeColour } from "@/lib/flat/colour";
import { boundsOfPoints, flatten } from "@/lib/flat/geometry";
import type { FlatElement, FlatPath, PathCommand, Point } from "@/lib/flat/model";
import { PATTERN_FALLBACK, type PatternPlace } from "@/lib/flat/kit-pattern";
import { NEUTRAL_FILL } from "@/lib/flat/colour";
import type { DisplayShape, PatternGenerator } from "./generator";
import { resolveColour } from "./colours";
import { resolveDatum } from "./datum";
import type { PatternLayer } from "./layers";
import { BUILT_IN_GENERATORS, findGenerator } from "./registry";
import type { ArtworkStack } from "./schema";
import type { PointMm } from "./units";

/**
 * A screen preview of a stack on a flat: the pattern layers of the view, drawn as the kit pattern is today. The flat
 * keeps drawing logos and names and numbers from the design's artwork list, which a stack in step with it repeats.
 * A flat draws every layer in the normal blend at full strength; the print files honour opacity and blend.
 */

const KAPPA = 0.5522847498;

/** Not rounded: the outline keeps its precision so the pattern is cut to it exactly as the flat cuts it. */
const mmPoint = (point: Point): PointMm => ({ x: point.x / 10, y: point.y / 10 });
const flatPoint = (point: PointMm): Point => ({ x: tidy(point.x * 10), y: tidy(point.y * 10) });

function circleCommands(centre: PointMm, radius: number): PathCommand[] {
  const [cx, cy, r] = [centre.x * 10, centre.y * 10, radius * 10];
  const k = r * KAPPA;
  const at = (x: number, y: number): Point => ({ x: tidy(x), y: tidy(y) });
  return [
    { op: "M", to: at(cx + r, cy) },
    { op: "C", c1: at(cx + r, cy + k), c2: at(cx + k, cy + r), to: at(cx, cy + r) },
    { op: "C", c1: at(cx - k, cy + r), c2: at(cx - r, cy + k), to: at(cx - r, cy) },
    { op: "C", c1: at(cx - r, cy - k), c2: at(cx - k, cy - r), to: at(cx, cy - r) },
    { op: "C", c1: at(cx + k, cy - r), c2: at(cx + r, cy - k), to: at(cx + r, cy) },
    { op: "Z" },
  ];
}

function pathOf(shape: DisplayShape, fallbackName: string): FlatPath {
  const commands: PathCommand[] =
    shape.kind === "circle"
      ? circleCommands(shape.centre, shape.radius)
      : [...shape.points.map((point, at): PathCommand => ({ op: at === 0 ? "M" : "L", to: flatPoint(point) })), { op: "Z" }];
  return { kind: "path", name: shape.name ?? fallbackName, panelId: null, commands, fill: shape.fill, stroke: null };
}

/** The body's outline as one closed run of points: the longest closed run of its path. */
function outlineOf(commands: readonly PathCommand[]): readonly Point[] | null {
  const runs = flatten(commands).filter((run) => run.closed && run.points.length >= 3);
  return runs.reduce<readonly Point[] | null>((best, run) => (best === null || run.points.length > best.length ? run.points : best), null);
}

interface DrawInput {
  readonly stack: ArtworkStack;
  readonly colourwayId: string;
  readonly place: PatternPlace;
  readonly generators: readonly PatternGenerator[];
}

function layerPaths(layer: PatternLayer, generator: PatternGenerator, body: FlatPath, outline: readonly Point[], input: DrawInput): FlatPath[] {
  const inks = layer.colourIds.map((id) => safeColour(resolveColour(input.stack, input.colourwayId, id)?.screen) ?? PATTERN_FALLBACK);
  const box = boundsOfPoints(outline);
  const underarm = mmPoint(input.place.underarm);
  const list = generator.render({
    view: input.place.view,
    bounds: { minX: box.minX / 10, minY: box.minY / 10, maxX: box.maxX / 10, maxY: box.maxY / 10 },
    clip: outline.map(mmPoint),
    landmarks: { underarm },
    datum: resolveDatum(layer.datum, underarm),
    colours: inks,
    ground: safeColour(body.fill) ?? NEUTRAL_FILL,
    params: layer.params,
    seed: layer.seed ?? 0,
    decoration: input.place.decoration,
  });
  return list.shapes.map((shape) => pathOf(shape, generator.label));
}

/**
 * The panels of one view with the stack's pattern layers printed on the body: their pieces straight after the body
 * panel, then the body's outline again on top, as the kit pattern is drawn. Panels are unchanged when no pattern
 * layer is on this view, a generator is not known, or the view has no body.
 */
export function withStackPatterns(
  panels: readonly FlatElement[],
  stack: ArtworkStack,
  place: PatternPlace,
  colourwayId: string,
  generators: readonly PatternGenerator[] = BUILT_IN_GENERATORS,
): readonly FlatElement[] {
  const at = panels.findIndex((element) => element.kind === "path" && element.panelId === `body-${place.view}`);
  const body = panels[at];
  const outline = body?.kind === "path" ? outlineOf(body.commands) : null;
  if (body?.kind !== "path" || outline === null) return panels;
  const input: DrawInput = { stack, colourwayId, place, generators };
  const drawn = stack.layers.flatMap((layer) => {
    const generator = layer.kind === "pattern" && layer.views.includes(place.view) ? findGenerator(layer.generatorId, generators) : undefined;
    return layer.kind === "pattern" && generator !== undefined ? layerPaths(layer, generator, body, outline, input) : [];
  });
  if (drawn.length === 0) return panels;
  const edge: FlatPath = { ...body, name: `${body.name} outline`, panelId: null, fill: null };
  return [...panels.slice(0, at + 1), ...drawn, edge, ...panels.slice(at + 1)];
}
