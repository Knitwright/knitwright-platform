import { z } from "zod";
import { ARTWORK_LIMITS } from "../limits";
import type { Matrix } from "./matrix";
import type { PathCmd } from "./path-data";

/**
 * The restricted vector model. An uploaded SVG or PDF is reduced to this and stored as JSON: paths,
 * solid and gradient fills, strokes, clip paths, transforms and embedded pictures, and nothing else.
 * There is no way to say script, link, font, filter or style in it, so nothing here can run.
 */

export const VECTOR_MODEL_VERSION = 1;

const num = z.number().finite().min(-1e7).max(1e7);
const unit = z.number().finite().min(0).max(1);
const colour = z.string().regex(/^#[0-9a-f]{6}$/);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

const matrix = z.tuple([num, num, num, num, num, num]).readonly();

const command = z.union([
  z.tuple([z.literal("M"), num, num]),
  z.tuple([z.literal("L"), num, num]),
  z.tuple([z.literal("C"), num, num, num, num, num, num]),
  z.tuple([z.literal("Z")]),
]);

const paint = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("colour"), hex: colour }),
  z.object({ kind: z.literal("gradient"), id }),
]);
export type VectorPaint = z.output<typeof paint>;

const stroke = z.object({
  paint,
  width: z.number().finite().min(0).max(1e5),
  opacity: unit,
  cap: z.enum(["butt", "round", "square"]),
  join: z.enum(["miter", "round", "bevel"]),
  miterLimit: z.number().finite().min(1).max(100),
  dash: z.array(z.number().finite().min(0).max(1e5)).max(16).optional(),
});

const common = { opacity: unit, m: matrix.optional(), clip: id.optional() };

export type VectorNode =
  | Readonly<{ t: "g"; opacity: number; m?: Matrix; clip?: string; children: readonly VectorNode[] }>
  | Readonly<{
      t: "path";
      opacity: number;
      m?: Matrix;
      clip?: string;
      cmds: readonly PathCmd[];
      fill: z.output<typeof paint> | null;
      fillOpacity: number;
      fillRule: "nonzero" | "evenodd";
      stroke: z.output<typeof stroke> | null;
    }>
  | Readonly<{ t: "image"; opacity: number; m?: Matrix; clip?: string; x: number; y: number; width: number; height: number; png: string }>;

const node: z.ZodType<VectorNode> = z.lazy(() =>
  z.discriminatedUnion("t", [
    z.object({ t: z.literal("g"), ...common, children: z.array(node).max(ARTWORK_LIMITS.vector.maxElements) }),
    z.object({
      t: z.literal("path"),
      ...common,
      cmds: z.array(command).max(ARTWORK_LIMITS.vector.maxPathCommands),
      fill: paint.nullable(),
      fillOpacity: unit,
      fillRule: z.enum(["nonzero", "evenodd"]),
      stroke: stroke.nullable(),
    }),
    z.object({
      t: z.literal("image"),
      ...common,
      x: num,
      y: num,
      width: z.number().finite().positive().max(1e7),
      height: z.number().finite().positive().max(1e7),
      png: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(6 * 1024 * 1024),
    }),
  ]),
) as z.ZodType<VectorNode>;

const stop = z.object({ offset: unit, hex: colour, opacity: unit });

const gradient = z.discriminatedUnion("type", [
  z.object({ type: z.literal("linear"), id, x1: num, y1: num, x2: num, y2: num, stops: z.array(stop).min(1).max(64), m: matrix.optional() }),
  z.object({ type: z.literal("radial"), id, cx: num, cy: num, r: z.number().finite().min(0).max(1e7), fx: num, fy: num, stops: z.array(stop).min(1).max(64), m: matrix.optional() }),
]);

const clip = z.object({ id, nodes: z.array(node).max(1000) });

export const vectorDocSchema = z.object({
  schemaVersion: z.literal(VECTOR_MODEL_VERSION),
  kind: z.literal("vector"),
  /** Where it came from. The original is never stored. */
  source: z.enum(["svg", "pdf"]),
  viewBox: z.object({ x: num, y: num, width: z.number().finite().positive().max(1e6), height: z.number().finite().positive().max(1e6) }),
  /** The size the file states, when it states one. */
  naturalWidthMm: z.number().finite().positive().max(1e6).nullable(),
  gradients: z.array(gradient).max(1000),
  clips: z.array(clip).max(1000),
  nodes: z.array(node).max(ARTWORK_LIMITS.vector.maxElements),
  /** Text in the file was left out; it must be outlined to be printed. */
  textOmitted: z.boolean(),
  warnings: z.array(z.string().max(300)).max(20),
});

export type VectorDoc = z.output<typeof vectorDocSchema>;
export type VectorGradient = z.output<typeof gradient>;
export type VectorStroke = z.output<typeof stroke>;
