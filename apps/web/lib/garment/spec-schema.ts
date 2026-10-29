import { z } from "zod";
import {
  artworkSchema,
  colourwaySchema,
  fabricSchema,
  measurementSchema,
  optionChoiceSchema,
  panelFabricSchema,
  sizeMeasurementSchema,
  sizingSchema,
  toleranceSchema,
} from "./parts";
import { artworkStackSchema } from "../artwork-stack/schema";
import { kitPatternSchema } from "./kit-pattern";
import { namesAndNumbersSchema } from "./names-numbers";
import { kebabId, wearerSchema } from "./primitives";
import { specProblems } from "./spec-checks";
import { componentSchema, constructionEntrySchema, labellingSchema } from "./tech-parts";

export const SPEC_SCHEMA_VERSION = 7;

/**
 * The base article a design sits on (plan v5 X4, decision 0069): its catalogue code, production class and the
 * structural parameters chosen inside the article's approved ranges. Added in version 7 and optional: a design saved
 * before has none, and validation works one out from the garment type (lib/validation `articleOf`).
 */
export const articleRefSchema = z
  .strictObject({
    baseArticleCode: z.string().regex(/^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$/),
    productionClass: z.enum(["A", "B"]),
    parameters: z
      .record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), z.union([z.number().finite(), z.string().max(64), z.boolean()]))
      .refine((params) => Object.keys(params).length <= 32, { message: "A design takes at most 32 parameters." })
      .readonly(),
  })
  .readonly();
export type ArticleRef = z.output<typeof articleRefSchema>;

/** Sanity limits on list sizes, so one spec cannot grow without bound. */
const MAX_MEASUREMENTS = 64;
const MAX_ARTWORK = 48;
const MAX_PANEL_FABRICS = 32;
export const MAX_COMPONENTS = 24;
export const MAX_CONSTRUCTION = 32;
/** Far more than a real size run needs: a design measured at every size has a few dozen. */
const MAX_SIZE_MEASUREMENTS = 512;

/**
 * The shape of a design, with no check against the registry. A design saved under
 * older registry data still has this shape, so it can be read and then repaired.
 * It holds only what a person or the assistant chose. Anything that can be worked
 * out, such as the list of panels, is left out. Unknown keys are refused.
 */
export const garmentSpecStructureSchema = z
  .strictObject({
    schemaVersion: z.literal(SPEC_SCHEMA_VERSION),
    typeId: kebabId,
    wearer: wearerSchema,
    /** The choice for each option that applies, keyed by option id, and who chose it. */
    options: z.record(kebabId, optionChoiceSchema).readonly(),
    /** Null until the person sets a size run. Measurements are values at the base size. */
    sizing: sizingSchema.nullable(),
    measurements: z.array(measurementSchema).max(MAX_MEASUREMENTS).readonly(),
    /**
     * Values typed for sizes other than the base size, and tolerances typed by a person.
     * Optional and added after version 6 without a bump, so every design saved before still reads.
     */
    sizeMeasurements: z.array(sizeMeasurementSchema).max(MAX_SIZE_MEASUREMENTS).readonly().optional(),
    tolerances: z.array(toleranceSchema).max(MAX_MEASUREMENTS).readonly().optional(),
    /** Never empty. Panels with no entry in `panelFabrics` use the first. */
    fabrics: z.tuple([fabricSchema], fabricSchema).readonly(),
    panelFabrics: z.array(panelFabricSchema).max(MAX_PANEL_FABRICS).readonly(),
    /** Never empty. */
    colourways: z.tuple([colourwaySchema], colourwaySchema).readonly(),
    artwork: z.array(artworkSchema).max(MAX_ARTWORK).readonly(),
    /** What the user says about thread, labels, rib and trims. At most one entry for each slot. */
    components: z.array(componentSchema).max(MAX_COMPONENTS).readonly(),
    /** Overrides of how a seam is sewn, and stitch densities. At most one entry for each seam. */
    construction: z.array(constructionEntrySchema).max(MAX_CONSTRUCTION).readonly(),
    /** Care, composition, origin, fold and bag. Only the fields the user filled in. */
    labelling: labellingSchema,
    /**
     * Player names and numbers: where they go and how they look, never a roster. Optional and
     * added after version 6 without a bump, so every design saved before still reads.
     */
    namesAndNumbers: namesAndNumbersSchema.optional(),
    /**
     * A style printed over the body, such as hoops or a sash. Optional and added after
     * version 6 without a bump, so every design saved before still reads.
     */
    kitPattern: kitPatternSchema.optional(),
    /**
     * The design's artwork as one stack of layers (decision 0035). Optional and added after version 6
     * without a bump. While it is absent the app works one out from `kitPattern`, `artwork`,
     * `namesAndNumbers` and the panel colours; the older fields are kept in step when it is written.
     */
    artworkStack: artworkStackSchema.optional(),
    /** The base article and its parameters (version 7). Absent on older designs. */
    article: articleRefSchema.optional(),
  })
  .readonly();

/** The full contract: the shape, plus every check against the registry. */
export const garmentSpecSchema = garmentSpecStructureSchema
  .unwrap()
  .superRefine((spec, context) => {
    for (const found of specProblems(spec)) {
      context.addIssue({ code: "custom", message: found.message, path: [...found.path] });
    }
  })
  .readonly();

export type GarmentSpec = z.output<typeof garmentSpecSchema>;
