import { z } from "zod";
import { VECTOR_LIMITS } from "../settings";

/**
 * The restricted vector model: what an uploaded SVG becomes. It is JSON, it has no scripts, styles, links
 * or text, and it is the only form in which a vector is stored. Paths are absolute segments; shapes are
 * already paths; every colour is a hex string; styles are already worked out.
 */

const finite = z.number().finite();
const hex = z.string().regex(/^#[0-9a-f]{6}$/);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

const matrixSchema = z.tuple([finite, finite, finite, finite, finite, finite]);

const segmentSchema = z.union([
  z.tuple([z.literal("M"), finite, finite]),
  z.tuple([z.literal("L"), finite, finite]),
  z.tuple([z.literal("C"), finite, finite, finite, finite, finite, finite]),
  z.tuple([z.literal("Q"), finite, finite, finite, finite]),
  z.tuple([z.literal("Z")]),
]);

export const paintSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("colour"), hex, opacity: z.number().min(0).max(1) }),
  z.object({ type: z.literal("gradient"), gradientId: id, opacity: z.number().min(0).max(1) }),
]);
export type Paint = z.infer<typeof paintSchema>;

const stopSchema = z.object({ offset: z.number().min(0).max(1), hex, opacity: z.number().min(0).max(1) });

const gradientCommon = {
  id,
  units: z.enum(["objectBoundingBox", "userSpaceOnUse"]),
  spread: z.enum(["pad", "reflect", "repeat"]),
  transform: matrixSchema.optional(),
  stops: z.array(stopSchema).min(1).max(VECTOR_LIMITS.maxGradientStops),
};

export const gradientSchema = z.discriminatedUnion("type", [
  z.object({ ...gradientCommon, type: z.literal("linear"), x1: finite, y1: finite, x2: finite, y2: finite }),
  z.object({ ...gradientCommon, type: z.literal("radial"), cx: finite, cy: finite, r: finite, fx: finite, fy: finite }),
]);
export type Gradient = z.infer<typeof gradientSchema>;

const styleCommon = {
  transform: matrixSchema.optional(),
  opacity: z.number().min(0).max(1),
  clipId: id.optional(),
};

export const pathNodeSchema = z.object({
  ...styleCommon,
  kind: z.literal("path"),
  segments: z.array(segmentSchema).min(1).max(VECTOR_LIMITS.maxPathCommands * 4),
  fill: paintSchema,
  fillRule: z.enum(["nonzero", "evenodd"]),
  stroke: paintSchema,
  strokeWidth: z.number().min(0).max(100_000),
  lineCap: z.enum(["butt", "round", "square"]),
  lineJoin: z.enum(["miter", "round", "bevel"]),
  miterLimit: z.number().min(1).max(100),
});
export type PathNode = z.infer<typeof pathNodeSchema>;

export const imageNodeSchema = z.object({
  ...styleCommon,
  kind: z.literal("image"),
  x: finite,
  y: finite,
  width: finite.positive(),
  height: finite.positive(),
  /** The picture, re-read and re-written as pixels; never the bytes that came in. */
  png: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(Math.ceil((VECTOR_LIMITS.maxEmbeddedImageBytes * 4) / 3) + 8),
});
export type ImageNode = z.infer<typeof imageNodeSchema>;

export type GroupNode = {
  readonly kind: "group";
  readonly transform?: z.infer<typeof matrixSchema>;
  readonly opacity: number;
  readonly clipId?: string;
  readonly children: readonly VectorNode[];
};
export type VectorNode = PathNode | ImageNode | GroupNode;

const nodeSchema: z.ZodType<VectorNode> = z.lazy(() =>
  z.union([
    pathNodeSchema,
    imageNodeSchema,
    z.object({ ...styleCommon, kind: z.literal("group"), children: z.array(nodeSchema).max(VECTOR_LIMITS.maxNodes) }),
  ]),
);

export const clipSchema = z.object({ id, children: z.array(pathNodeSchema).min(1).max(512) });
export type Clip = z.infer<typeof clipSchema>;

export const VECTOR_MODEL_VERSION = 1;

export const vectorModelSchema = z.object({
  schemaVersion: z.literal(VECTOR_MODEL_VERSION),
  /** The drawing's own coordinate box. */
  viewBox: z.object({ x: finite, y: finite, width: finite.positive(), height: finite.positive() }),
  /** The size the file states in a real unit (mm, cm, in, pt), or null. A size in pixels is not a measurement. */
  statedSizeMm: z.object({ width: finite.positive(), height: finite.positive() }).nullable(),
  gradients: z.array(gradientSchema).max(256),
  clips: z.array(clipSchema).max(256),
  nodes: z.array(nodeSchema).max(VECTOR_LIMITS.maxNodes),
});
export type VectorModel = z.infer<typeof vectorModelSchema>;
