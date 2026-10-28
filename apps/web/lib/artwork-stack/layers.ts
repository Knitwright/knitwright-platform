import { z } from "zod";
import { LETTERING_STYLES, PLAYER_MARK_PLACES } from "@/lib/garment/names-numbers";
import { ARTWORK_TEXT_MAX_LENGTH, NAME_MAX_LENGTH, TECHNIQUES } from "@/lib/garment/parts";
import { freeText, kebabId, localId } from "@/lib/garment/primitives";
import { provenanceSchema } from "@/lib/garment/provenance";
import { viewIdSchema } from "./anchors";
import { blendSchema } from "./blend";
import { stackId } from "./colours";
import { datumSchema } from "./datum";
import { lengthMmSchema, pointMmSchema } from "./units";

/** What every layer has. Order in the stack's array is the blend order. */
const common = {
  id: localId,
  /** A plain name for the layer, such as "Club crest". */
  name: freeText(NAME_MAX_LENGTH).optional(),
  /** The views it is drawn on. */
  views: z.array(viewIdSchema).min(1).max(5).readonly(),
  opacity: z.number().min(0).max(1),
  blend: blendSchema,
  technique: z.enum(TECHNIQUES).optional(),
  /** Typed by the user, read from a picture, or suggested. */
  provenance: provenanceSchema,
};

const rotation = z.number().finite().min(0).lt(360);
const clearSpace = z.number().finite().min(0).max(200);

export const groundLayerSchema = z.object({ ...common, kind: z.literal("ground"), colourId: stackId }).readonly();

/** Parameters are plain values with a name. The generator says which names it has and their ranges. */
const patternParamsSchema = z
  .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/), z.union([z.number().finite(), z.string().max(60), z.boolean()]))
  .refine((params) => Object.keys(params).length <= 16, { message: "A pattern takes at most 16 settings." })
  .readonly();

/** All styles, old and new, are this one kind behind the generator interface. */
export const patternLayerSchema = z
  .object({
    ...common,
    kind: z.literal("pattern"),
    generatorId: stackId,
    params: patternParamsSchema,
    seed: z.number().int().min(0).max(2_147_483_647).optional(),
    datum: datumSchema,
    colourIds: z.array(stackId).min(1).max(6).readonly(),
  })
  .readonly();

/** `scale` is the printed size as a multiple of the picture's natural size at its own resolution. A photo is never recolourable. */
export const imageFillLayerSchema = z
  .object({
    ...common,
    kind: z.literal("image-fill"),
    assetId: localId,
    mode: z.enum(["tile", "panel"]),
    scale: z.number().finite().gt(0).max(100),
    rotationDeg: rotation,
    offsetMm: pointMmSchema,
    halfDrop: z.boolean(),
    fit: z.enum(["cover", "contain"]),
    recolourIds: z.array(stackId).min(1).max(6).readonly().optional(),
  })
  .readonly();

/** A named zone (defined by the print files) or a named anchor on a view. A free anchor is allowed and is reported as outside the standard zones. */
export const placementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("zone"), zoneId: kebabId }).readonly(),
  z.object({ kind: z.literal("anchor"), anchorId: kebabId, panelId: kebabId.optional() }).readonly(),
]);
export type Placement = z.output<typeof placementSchema>;

/** A picture or vector: an uploaded asset (a vector asset is read as vectors), or a file stored by the older logo path. */
const graphicSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("asset"), assetId: localId }).readonly(),
  z.object({ kind: z.literal("file"), fileId: z.uuid() }).readonly(),
]);

export const graphicLayerSchema = z
  .object({
    ...common,
    kind: z.literal("graphic"),
    source: graphicSourceSchema,
    placement: placementSchema,
    offsetMm: pointMmSchema,
    widthMm: lengthMmSchema,
    heightMm: lengthMmSchema.optional(),
    rotationDeg: rotation,
    clearSpaceMm: clearSpace,
    knockOut: z.boolean(),
  })
  .readonly();

export const textLayerSchema = z
  .object({
    ...common,
    kind: z.literal("text"),
    text: freeText(ARTWORK_TEXT_MAX_LENGTH).min(1, "Enter the text to print."),
    lettering: z.enum(LETTERING_STYLES).optional(),
    placement: placementSchema,
    offsetMm: pointMmSchema,
    heightMm: lengthMmSchema,
    widthMm: lengthMmSchema.optional(),
    rotationDeg: rotation,
    colourId: stackId.optional(),
  })
  .readonly();

/** The name and number come from the roster at print time. `sample` is only what a drawing shows. */
export const playerMarkLayerSchema = z
  .object({
    ...common,
    kind: z.literal("player-mark"),
    place: z.enum(PLAYER_MARK_PLACES),
    style: z.enum(LETTERING_STYLES).optional(),
    heightMm: lengthMmSchema.optional(),
    colourId: stackId.optional(),
    sample: z.object({ name: freeText(20).min(1), number: z.string().regex(/^\d{1,2}$/) }).readonly().optional(),
  })
  .readonly();

export const layerSchema = z.discriminatedUnion("kind", [
  groundLayerSchema,
  patternLayerSchema,
  imageFillLayerSchema,
  graphicLayerSchema,
  textLayerSchema,
  playerMarkLayerSchema,
]);
export type Layer = z.output<typeof layerSchema>;
export type PatternLayer = z.output<typeof patternLayerSchema>;
export type GraphicLayer = z.output<typeof graphicLayerSchema>;
export type TextLayer = z.output<typeof textLayerSchema>;
export type PlayerMarkLayer = z.output<typeof playerMarkLayerSchema>;
export type GroundLayer = z.output<typeof groundLayerSchema>;
export type ImageFillLayer = z.output<typeof imageFillLayerSchema>;

/** The colour ids a layer names. */
export function colourIdsOf(layer: Layer): readonly string[] {
  switch (layer.kind) {
    case "ground":
      return [layer.colourId];
    case "pattern":
      return layer.colourIds;
    case "image-fill":
      return layer.recolourIds ?? [];
    case "text":
    case "player-mark":
      return layer.colourId === undefined ? [] : [layer.colourId];
    case "graphic":
      return [];
  }
}
