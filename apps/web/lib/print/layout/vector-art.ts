import { z } from "zod";
import { vectorModelSchema, type VectorModel, type VectorNode } from "@/lib/artwork-intake";
import { HEX } from "../rules/colour";

/**
 * The vector print copy of an uploaded logo as the print files read it: straight-edged shapes in a box, y down.
 * The artwork intake (W7b) stores a restricted vector model as JSON, never SVG (`VectorModel`); `readVectorArt`
 * reads that model, applies its transforms and flattens its curves. What cannot be kept (a picture inside the logo,
 * a clip, a see-through part, a gradient) is said in `notes`, never dropped quietly. Anything that does not match the
 * model is refused with a sentence, never guessed at.
 */
const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);
const colourSchema = z.string().regex(HEX);

const shapeSchema = z.object({
  fill: colourSchema.nullable(),
  stroke: z.object({ colour: colourSchema, widthMm: z.number().finite().positive().max(1_000_000) }).nullable(),
  rings: z.array(z.array(pointSchema).min(2).max(20_000)).min(1).max(200),
  closed: z.boolean(),
});

export const vectorArtSchema = z.object({
  version: z.literal(1),
  width: z.number().finite().positive().max(1_000_000),
  height: z.number().finite().positive().max(1_000_000),
  shapes: z.array(shapeSchema).min(1).max(2000),
});
export type VectorArt = z.output<typeof vectorArtSchema>;

export const VECTOR_REFUSED = "This logo could not be read as vector artwork, so it was left off.";

export const VECTOR_NOTES = {
  gradient: "A gradient in this logo is printed as one flat colour, from the middle of the gradient.",
  image: "A picture inside this logo was left off. Upload the logo as a picture to keep it.",
  clip: "A clipped part of this logo is printed unclipped.",
  opacity: "See-through parts of this logo are printed solid. Set the whole logo's opacity instead.",
} as const;

/** Segments per curve. Fixed, so the same file always flattens to the same points. */
const CUBIC_STEPS = 16;
const QUAD_STEPS = 12;

type PathNode = Extract<VectorNode, { kind: "path" }>;
type Matrix = readonly [number, number, number, number, number, number];
type Point = readonly [number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `outer` applied after `inner`. */
const then = (outer: Matrix, inner: Matrix): Matrix => [
  outer[0] * inner[0] + outer[2] * inner[1],
  outer[1] * inner[0] + outer[3] * inner[1],
  outer[0] * inner[2] + outer[2] * inner[3],
  outer[1] * inner[2] + outer[3] * inner[3],
  outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
  outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
];

const move = (m: Matrix, [x, y]: Point): Point => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const lengthScale = (m: Matrix): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

const along = (steps: number, at: (t: number) => Point): Point[] => Array.from({ length: steps }, (_, i) => at((i + 1) / steps));

const cubic = (p0: Point, a: Point, b: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [w[0] * p0[0] + w[1] * a[0] + w[2] * b[0] + w[3] * p1[0], w[0] * p0[1] + w[1] * a[1] + w[2] * b[1] + w[3] * p1[1]];
};

const quad = (p0: Point, a: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * a[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * a[1] + t * t * p1[1]];
};

interface Run {
  readonly points: Point[];
  readonly closed: boolean;
}

/** A path's segments as straight runs in the drawing's box, one run per sub-path. */
function runsOf(segments: PathNode["segments"], matrix: Matrix): Run[] {
  const runs: Run[] = [];
  let current: Point[] = [];
  let at: Point = [0, 0];
  const finish = (closed: boolean): void => {
    if (current.length > 0) runs.push({ points: current, closed });
    current = [];
  };
  for (const segment of segments) {
    if (segment[0] === "M") {
      finish(false);
      at = [segment[1], segment[2]];
      current = [move(matrix, at)];
    } else if (segment[0] === "L") {
      at = [segment[1], segment[2]];
      current.push(move(matrix, at));
    } else if (segment[0] === "C") {
      const [from, a, b, to] = [at, [segment[1], segment[2]], [segment[3], segment[4]], [segment[5], segment[6]]] as Point[] as [Point, Point, Point, Point];
      current.push(...along(CUBIC_STEPS, (t) => move(matrix, cubic(from, a, b, to, t))));
      at = to;
    } else if (segment[0] === "Q") {
      const [from, a, to] = [at, [segment[1], segment[2]], [segment[3], segment[4]]] as Point[] as [Point, Point, Point];
      current.push(...along(QUAD_STEPS, (t) => move(matrix, quad(from, a, to, t))));
      at = to;
    } else {
      finish(true);
    }
  }
  finish(false);
  return runs;
}

interface Walk {
  readonly model: VectorModel;
  readonly shapes: { fill: string | null; stroke: { colour: string; widthMm: number } | null; closed: boolean; rings: (readonly Point[])[] }[];
  readonly notes: Set<string>;
}

/** The flat colour of a gradient: the stop nearest its middle. */
function flatColour(walk: Walk, paint: { readonly type: string; readonly hex?: string; readonly gradientId?: string }): string | null {
  if (paint.type === "colour") return paint.hex ?? null;
  if (paint.type !== "gradient") return null;
  walk.notes.add(VECTOR_NOTES.gradient);
  const stops = walk.model.gradients.find((entry) => entry.id === paint.gradientId)?.stops ?? [];
  const middle = [...stops].sort((a, b) => Math.abs(a.offset - 0.5) - Math.abs(b.offset - 0.5))[0];
  return middle?.hex ?? null;
}

const MIN_AREA_POINTS = 2;

function addPath(walk: Walk, node: PathNode, matrix: Matrix): void {
  if (node.clipId !== undefined) walk.notes.add(VECTOR_NOTES.clip);
  if (node.opacity < 1) walk.notes.add(VECTOR_NOTES.opacity);
  const own = node.transform ? then(matrix, node.transform) : matrix;
  const runs = runsOf(node.segments, own).filter((run) => run.points.length >= MIN_AREA_POINTS);
  const fill = flatColour(walk, node.fill);
  const stroke = flatColour(walk, node.stroke);
  if (fill && runs.length > 0) walk.shapes.push({ fill, stroke: null, closed: true, rings: runs.map((run) => run.points) });
  const width = node.strokeWidth * lengthScale(own);
  if (stroke && width > 0) for (const run of runs) walk.shapes.push({ fill: null, stroke: { colour: stroke, widthMm: width }, closed: run.closed, rings: [run.points] });
}

function walkNodes(walk: Walk, nodes: readonly VectorNode[], matrix: Matrix): void {
  for (const node of nodes) {
    if (node.kind === "image") walk.notes.add(VECTOR_NOTES.image);
    else if (node.kind === "path") addPath(walk, node, matrix);
    else {
      if (node.clipId !== undefined) walk.notes.add(VECTOR_NOTES.clip);
      if (node.opacity < 1) walk.notes.add(VECTOR_NOTES.opacity);
      walkNodes(walk, node.children, node.transform ? then(matrix, node.transform) : matrix);
    }
  }
}

const parseJson = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
};

/** The artwork and what had to be simplified to print it, or null when the file is not a vector model the print can draw. */
export function readVectorArt(bytes: Uint8Array): { readonly art: VectorArt; readonly notes: readonly string[] } | null {
  const parsed = vectorModelSchema.safeParse(parseJson(bytes));
  if (!parsed.success) return null;
  const { viewBox } = parsed.data;
  const walk: Walk = { model: parsed.data, shapes: [], notes: new Set() };
  walkNodes(walk, parsed.data.nodes, then([1, 0, 0, 1, -viewBox.x, -viewBox.y], IDENTITY));
  const art = vectorArtSchema.safeParse({ version: 1, width: viewBox.width, height: viewBox.height, shapes: walk.shapes });
  return art.success ? { art: art.data, notes: [...walk.notes] } : null;
}
