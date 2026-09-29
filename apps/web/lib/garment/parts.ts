import { z } from "zod";
import { freeText, kebabId, localId } from "./primitives";
import { provenanceSchema } from "./provenance";
import { MEASUREMENT_MAX_TENTHS_MM } from "./units";

export const NAME_MAX_LENGTH = 60;
export const COLOUR_MAX_LENGTH = 60;
export const ARTWORK_TEXT_MAX_LENGTH = 80;
export const FABRIC_TEXT_MAX_LENGTH = 200;
/** A sanity limit on fabric weight in grams per square metre, to catch typing slips. */
export const FABRIC_WEIGHT_MAX_GSM = 2000;
export const MAX_ROTATION_DEGREES = 359;
export const SIZE_LABEL_MAX_LENGTH = 12;
export const MAX_SIZES = 24;

/** One measured value. It always says where it came from. */
export const measurementShape = {
  pointId: kebabId,
  /** Whole tenths of a millimetre. */
  value: z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM),
  provenance: provenanceSchema,
};

export const measurementSchema = z.object(measurementShape).readonly();
export type Measurement = z.output<typeof measurementSchema>;

export const STRETCH_VALUES = ["not-set", "none", "two-way", "four-way"] as const;

export const fabricSchema = z
  .object({
    id: localId,
    name: freeText(NAME_MAX_LENGTH).min(1, "Give the fabric a name."),
    composition: freeText(FABRIC_TEXT_MAX_LENGTH),
    construction: freeText(FABRIC_TEXT_MAX_LENGTH),
    /** Grams per square metre, or null while unknown. */
    weightGsm: z.number().int().min(1).max(FABRIC_WEIGHT_MAX_GSM).nullable(),
    finish: freeText(FABRIC_TEXT_MAX_LENGTH),
    stretch: z.enum(STRETCH_VALUES),
    /** Where this fabric's details came from. */
    provenance: provenanceSchema,
  })
  .readonly();
export type FabricSpec = z.output<typeof fabricSchema>;

/** The details of a fabric with nothing filled in yet. Adding an id, name and provenance makes it valid. */
export const EMPTY_FABRIC_DETAILS: Pick<
  FabricSpec,
  "composition" | "construction" | "weightGsm" | "finish" | "stretch"
> = Object.freeze({
  composition: "",
  construction: "",
  weightGsm: null,
  finish: "",
  stretch: "not-set",
});

/** Says which fabric a panel uses. A panel with no entry uses the first fabric. */
export const panelFabricSchema = z.object({ panelId: kebabId, fabricId: localId }).readonly();
export type PanelFabric = z.output<typeof panelFabricSchema>;

/** A colour a screen or a drawing can show: `#`, then six lower case hex digits. */
export const SWATCH_PATTERN = /^#[0-9a-f]{6}$/;

const panelColourSchema = z
  .object({
    panelId: kebabId,
    /**
     * Free text, such as a Pantone name. Colour libraries are licensed, so codes are never
     * looked up. It may be empty when a swatch is set: a colour picked for the screen is not
     * a colour reference for a factory, and must not be stored as one.
     */
    colour: freeText(COLOUR_MAX_LENGTH),
    /** The colour to draw, such as `#1b2a49`. Optional: a panel without one is drawn in light grey. */
    swatch: z.string().regex(SWATCH_PATTERN, "Use a colour like #1b2a49.").optional(),
    provenance: provenanceSchema,
  })
  .readonly()
  .refine((entry) => entry.colour !== "" || entry.swatch !== undefined, { message: "Enter a colour.", path: ["colour"] });

export const colourwaySchema = z
  .object({
    id: localId,
    name: freeText(NAME_MAX_LENGTH).min(1, "Give the colourway a name."),
    colours: z.array(panelColourSchema).readonly(),
  })
  .readonly()
  .refine(
    (colourway) => new Set(colourway.colours.map((entry) => entry.panelId)).size === colourway.colours.length,
    { message: "Each panel can have only one colour in a colourway.", path: ["colours"] },
  );
export type Colourway = z.output<typeof colourwaySchema>;
export type PanelColour = z.output<typeof panelColourSchema>;

export const TECHNIQUES = ["sublimation", "transfer", "screen-print", "embroidery"] as const;

const artworkSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), fileId: z.uuid() }).readonly(),
  z
    .object({
      kind: z.literal("text"),
      text: freeText(ARTWORK_TEXT_MAX_LENGTH).min(1, "Enter the text to print."),
    })
    .readonly(),
]);

const offset = z.number().int().min(-MEASUREMENT_MAX_TENTHS_MM).max(MEASUREMENT_MAX_TENTHS_MM);
const size = z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM);

/**
 * Artwork on one panel. Position and size are tenths of a millimetre, measured from
 * a named anchor on the panel, such as the centre of the chest. They are not pixels.
 */
export const artworkSchema = z
  .object({
    id: localId,
    name: freeText(NAME_MAX_LENGTH).min(1, "Give the artwork a name."),
    source: artworkSourceSchema,
    panelId: kebabId,
    anchor: kebabId,
    offsetX: offset,
    offsetY: offset,
    width: size,
    height: size,
    /** Whole degrees, 0 to 359. */
    rotationDegrees: z.number().int().min(0).max(MAX_ROTATION_DEGREES).default(0),
    technique: z.enum(TECHNIQUES),
    provenance: provenanceSchema,
  })
  .readonly();
export type Artwork = z.output<typeof artworkSchema>;

/** One chosen option, and who chose it. A default worked out from the type is `derived`. */
export const optionChoiceSchema = z.object({ choiceId: kebabId, provenance: provenanceSchema }).readonly();
export type OptionChoice = z.output<typeof optionChoiceSchema>;

const sizeLabel = freeText(SIZE_LABEL_MAX_LENGTH).min(1, "Enter a size label.");

/**
 * The size run of a design, smallest first. Measurements in the spec are the values
 * at the base size. Other sizes are worked out from size chart data, not stored here.
 */
export const sizingSchema = z
  .object({
    sizes: z.array(sizeLabel).min(1, "Add at least one size.").max(MAX_SIZES).readonly(),
    baseSize: sizeLabel,
  })
  .readonly()
  .refine((sizing) => new Set(sizing.sizes).size === sizing.sizes.length, {
    message: "Each size can appear only once.",
    path: ["sizes"],
  })
  .refine((sizing) => sizing.sizes.includes(sizing.baseSize), {
    message: "The base size must be one of the sizes.",
    path: ["baseSize"],
  });
export type Sizing = z.output<typeof sizingSchema>;
