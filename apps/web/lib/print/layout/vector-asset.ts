import { FillRule, unionD } from "clipper2-ts";
import { z } from "zod";
import { vectorModelSchema, type VectorModel, type VectorNode } from "@/lib/artwork-intake";
import type { Pt } from "../geometry/vec";
import type { Shape } from "../geometry/boolean";

/**
 * The vector copy of an uploaded logo as the print files draw it: shapes with solid fills, in the logo's own units, y down.
 * The artwork intake (W7b) stores a vector upload as its restricted vector model (JSON, never SVG); `readVectorAsset` reads that
 * and also this plainer form, which the tests use. What the model holds that is not drawn yet (outline strokes, gradients as
 * gradients, clip paths, embedded pictures) is listed in `notDrawn`, so a person is told and nothing goes missing silently.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const ring = z.array(z.tuple([z.number().finite(), z.number().finite()])).min(3).max(20_000);

export const vectorCopySchema = z.object({
  kind: z.literal("vector"),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  shapes: z.array(z.object({ rings: z.array(ring).min(1).max(64), fill: hex, opacity: z.number().min(0).max(1).optional() })).min(1).max(5000),
});
export type VectorCopy = z.output<typeof vectorCopySchema>;

export interface VectorRead {
  readonly copy: VectorCopy;
  /** Plain phrases for what the file holds and the print files do not draw, such as "outline strokes". */
  readonly notDrawn: readonly string[];
}

type PathNode = Extract<VectorNode, { kind: "path" }>;
type Matrix = readonly [number, number, number, number, number, number];

const times = (m: Matrix, n: Matrix | undefined): Matrix =>
  n === undefined
    ? m
    : [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const apply = (m: Matrix, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** A curve as a run of short straight lines, each within 0.01 of a unit from the curve, in the logo's own units. */
function curve(from: Pt, controls: readonly Pt[], m: Matrix): Pt[] {
  const [a, ...rest] = [from, ...controls];
  const pts = [a, ...rest];
  const dev = Math.max(...pts.slice(1, -1).map((p) => Math.hypot(p[0] - (a[0] + pts[pts.length - 1][0]) / 2, p[1] - (a[1] + pts[pts.length - 1][1]) / 2)), 0);
  const n = Math.max(2, Math.min(64, Math.ceil(Math.sqrt(dev * Math.hypot(m[0], m[1]) * 4))));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    const point: Pt =
      pts.length === 3
        ? [u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0], u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1]]
        : [u ** 3 * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t ** 3 * pts[3][0], u ** 3 * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t ** 3 * pts[3][1]];
    out.push(apply(m, point[0], point[1]));
  }
  return out;
}

/** A path's segments as closed rings. An open run is closed, as a fill closes it. */
function ringsOf(node: PathNode, m: Matrix): Pt[][] {
  const rings: Pt[][] = [];
  let current: Pt[] = [];
  let at: Pt = [0, 0];
  const flush = (): void => {
    if (current.length >= 3) rings.push(current);
    current = [];
  };
  for (const seg of node.segments) {
    if (seg[0] === "M") {
      flush();
      at = [seg[1], seg[2]];
      current = [apply(m, at[0], at[1])];
    } else if (seg[0] === "L") {
      at = [seg[1], seg[2]];
      current.push(apply(m, at[0], at[1]));
    } else if (seg[0] === "C") {
      current.push(...curve(at, [[seg[1], seg[2]], [seg[3], seg[4]], [seg[5], seg[6]]], m));
      at = [seg[5], seg[6]];
    } else if (seg[0] === "Q") {
      current.push(...curve(at, [[seg[1], seg[2]], [seg[3], seg[4]]], m));
      at = [seg[3], seg[4]];
    } else flush();
  }
  flush();
  return rings;
}

/** The rings as outer rings and holes the other way round, whichever fill rule they were drawn with, so the cutting later is right. */
const normalised = (rings: Pt[][], rule: "nonzero" | "evenodd"): Pt[][] =>
  unionD(rings.map((r) => r.map(([x, y]) => ({ x, y }))), rule === "nonzero" ? FillRule.NonZero : FillRule.EvenOdd).map((p) => p.map((q): Pt => [q.x, q.y]));

interface Walk {
  readonly shapes: VectorCopy["shapes"][number][];
  readonly notDrawn: Set<string>;
  readonly model: VectorModel;
}

function walk(node: VectorNode, m: Matrix, opacity: number, w: Walk): void {
  const here = times(m, node.transform);
  const o = opacity * node.opacity;
  if (node.clipId !== undefined) w.notDrawn.add("clip paths");
  if (node.kind === "group") {
    for (const child of node.children) walk(child, here, o, w);
    return;
  }
  if (node.kind === "image") {
    w.notDrawn.add("pictures inside the logo");
    return;
  }
  if (node.stroke.type !== "none" && node.strokeWidth > 0) w.notDrawn.add("outline strokes");
  if (node.fill.type === "none") return;
  const colour = node.fill.type === "colour" ? node.fill.hex : (w.model.gradients.find((g) => g.id === (node.fill as { gradientId: string }).gradientId)?.stops[0]?.hex ?? "#000000");
  if (node.fill.type === "gradient") w.notDrawn.add("gradients (drawn as a flat colour)");
  const rings = ringsOf(node, here);
  if (rings.length === 0) return;
  const filled = normalised(rings, node.fillRule);
  const total = o * node.fill.opacity;
  w.shapes.push({ fill: colour, rings: filled, ...(total < 1 ? { opacity: total } : {}) });
}

/** The restricted vector model as a vector copy: curves flattened, groups and transforms worked through, the box moved to the origin. */
export function copyFromModel(model: VectorModel): VectorRead | null {
  const w: Walk = { shapes: [], notDrawn: new Set(), model };
  const { x, y, width, height } = model.viewBox;
  for (const node of model.nodes) walk(node, [1, 0, 0, 1, -x, -y], 1, w);
  if (w.shapes.length === 0) return null;
  return { copy: { kind: "vector", width, height, shapes: w.shapes.slice(0, 5000) }, notDrawn: [...w.notDrawn].sort() };
}

/** A vector asset's print copy, in either form, or null when it is neither. */
export function readVectorAsset(bytes: Uint8Array): VectorRead | null {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  const plain = vectorCopySchema.safeParse(json);
  if (plain.success) return { copy: plain.data, notDrawn: [] };
  const model = vectorModelSchema.safeParse(json);
  return model.success ? copyFromModel(model.data) : null;
}

export const encodeVectorCopy = (copy: VectorCopy): Uint8Array => new TextEncoder().encode(JSON.stringify(copy));
export const parseVectorCopy = (bytes: Uint8Array): VectorCopy | null => readVectorAsset(bytes)?.copy ?? null;

export const ringsOfCopy = (copy: VectorCopy): { fill: string; opacity?: number; shape: Shape }[] =>
  copy.shapes.map((s) => ({ fill: s.fill.toLowerCase(), ...(s.opacity === undefined ? {} : { opacity: s.opacity }), shape: s.rings.map((r) => r.map(([x, y]): Pt => [x, y])) }));
