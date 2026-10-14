import {
  findGenerator,
  kitStyleOf,
  resolveDatum,
  type DisplayList,
  type DisplayShape,
  type GeneratorContext,
  type PatternGenerator,
  type PatternLayer,
  type PointMm,
  type ViewId,
} from "@/lib/artwork-stack";
import { LANDMARK_IDS } from "@/lib/production/contract";
import { clipShape, type Shape } from "../geometry/boolean";
import { boundsOf, round2, type Pt } from "../geometry/vec";
import { screenColour, type BuildEnv } from "./context";
import type { PrintSpace } from "./print-space";
import type { FilledShape, Issue } from "./scene";

/** The most shapes one piece may take from one pattern layer. Over it, the pattern says it left detail out. */
export const SHAPE_BUDGET = 20_000;

export interface PatternBuild {
  readonly shapes: readonly FilledShape[];
  readonly issues: readonly Issue[];
  readonly notes: readonly string[];
}

/** The chord of a circle is kept within this many millimetres of the true arc. */
const CHORD_TOLERANCE_MM = 0.02;

export function circlePoints(centre: PointMm, radius: number): Pt[] {
  const steps = Math.max(16, Math.ceil(Math.PI / Math.acos(Math.max(0, 1 - CHORD_TOLERANCE_MM / Math.max(radius, CHORD_TOLERANCE_MM * 2)))));
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [round2(centre.x + Math.cos(a) * radius), round2(centre.y + Math.sin(a) * radius)];
  });
}

const planeRing = (shape: DisplayShape): Pt[] =>
  shape.kind === "circle" ? circlePoints(shape.centre, shape.radius) : shape.points.map((p): Pt => [p.x, p.y]);

/** Where a generator's output goes, one step away from the plane: shifted so the style that knows nothing of the datum lines up on it. */
interface Frame {
  readonly dx: number;
  readonly dy: number;
}

const LEGACY_REACH_MM = 2000;
const PHASED_STYLES: readonly string[] = ["kit-hoops", "kit-dots"];

/** The first row of a style that starts its rows from the top of the box it is given is put so rows keep one phase in every size and view. */
function legacyTop(params: Readonly<Record<string, number | string | boolean>>): number {
  const step = [params.rowStepMm, params.bandWidthMm].find((v): v is number => typeof v === "number" && v > 0) ?? 35;
  return -(Math.ceil(LEGACY_REACH_MM / step) + 0.5) * step;
}

function landmarksOf(env: BuildEnv, view: ViewId, size: string, shift: Frame): Record<string, PointMm> {
  const found: Record<string, PointMm> = {};
  for (const id of LANDMARK_IDS) {
    const at = env.mapper.landmarkPlane(view, id, size);
    if (at !== undefined) found[id] = { x: at.x - shift.dx, y: at.y - shift.dy };
  }
  return found;
}

export interface PatternInput {
  readonly env: BuildEnv;
  readonly layer: PatternLayer;
  readonly space: PrintSpace;
  readonly view: ViewId;
  readonly size: string;
  readonly bleedOutline: readonly Pt[];
  readonly ground: string;
}

function contextFor(input: PatternInput, legacy: boolean): { context: GeneratorContext; shift: Frame; problems: Issue[] } {
  const { env, layer, space, view, size } = input;
  const problems: Issue[] = [];
  const plane: PointMm[] = input.bleedOutline.map(space.toPlane);
  const box = boundsOf(plane.map((p): Pt => [p.x, p.y]));
  const chest = env.mapper.landmarkPlane("front", "underarm", size) ?? env.mapper.landmarkPlane(view, "underarm", size);
  const datum = resolveDatum(layer.datum, chest);
  const colours = layer.colourIds.map((id) => {
    const found = screenColour(env, id);
    if (found === null) problems.push({ code: "no-colour", layerId: layer.id, text: `Colour ${id} has no screen colour, so it is printed as black.` });
    return found ?? "#000000";
  });
  const base = { view, landmarks: {}, colours, ground: input.ground, params: layer.params, seed: layer.seed ?? 0 };
  if (!legacy) {
    const shift: Frame = { dx: 0, dy: 0 };
    const context: GeneratorContext = {
      ...base,
      bounds: { minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY },
      clip: plane,
      landmarks: landmarksOf(env, view, size, shift),
      datum,
    };
    return { context, shift, problems };
  }
  // The seven older styles draw to the box they are given and ignore the datum, so they are drawn on a plane whose origin
  // IS the datum (its centre line, at the chest line) and moved back. Hoops and dots start their rows from the top of the
  // box, so those two get a box whose top is a fixed distance above the datum: rows then keep one phase in every size and
  // on every piece. The others (the sash, the fade and so on) are tied to the body, so they take the body's own box.
  const frame = env.mapper.frame(view, size);
  const shift: Frame = { dx: (frame?.wornOrigin[0] ?? 0) + layer.datum.offsetMm.x, dy: datum.y };
  const local = plane.map((p): PointMm => ({ x: p.x - shift.dx, y: p.y - shift.dy }));
  const phased = PHASED_STYLES.includes(layer.generatorId);
  const context: GeneratorContext = {
    ...base,
    bounds: { minX: box.minX - shift.dx, maxX: box.maxX - shift.dx, minY: phased ? legacyTop(layer.params) : box.minY - shift.dy, maxY: box.maxY - shift.dy },
    ...(phased ? {} : { clip: local }),
    landmarks: landmarksOf(env, view, size, shift),
    datum: { x: 0, y: 0 },
  };
  return { context, shift, problems };
}

function drawn(list: DisplayList, shift: Frame, space: PrintSpace): FilledShape[] {
  return list.shapes.map((s) => ({
    fill: s.fill.toLowerCase(),
    shape: [planeRing(s).map(([x, y]) => space.toPrint({ x: x + shift.dx, y: y + shift.dy }))] as Shape,
  }));
}

/** One pattern layer on one piece, in print space, cut to the bleed outline. Pure and deterministic. */
export function buildPatternShapes(input: PatternInput): PatternBuild {
  const generator: PatternGenerator | undefined = findGenerator(input.layer.generatorId, input.env.generators);
  if (generator === undefined) {
    return { shapes: [], notes: [], issues: [{ code: "pattern-missing", layerId: input.layer.id, text: `The pattern "${input.layer.generatorId}" is not available here, so it is left out of this file.` }] };
  }
  const legacy = kitStyleOf(input.layer.generatorId) !== null;
  const { context, shift, problems } = contextFor(input, legacy);
  const list = generator.render(context);
  const all = drawn(list, shift, input.space);
  const box = boundsOf(input.bleedOutline);
  const shapes = all.flatMap((s) => {
    const cut = clipShape(s.shape, input.bleedOutline, box);
    return cut === null ? [] : [{ fill: s.fill, shape: cut }];
  });
  const limited = shapes.length > SHAPE_BUDGET;
  const notes = [list.note, limited ? `This pattern has more than ${SHAPE_BUDGET} shapes on this piece, so detail was left out.` : null].filter((n): n is string => n !== null && n !== undefined);
  const over: Issue[] = limited ? [{ code: "shape-budget", layerId: input.layer.id, text: notes[notes.length - 1] }] : [];
  return { shapes: limited ? shapes.slice(0, SHAPE_BUDGET) : shapes, issues: [...problems, ...over], notes };
}
