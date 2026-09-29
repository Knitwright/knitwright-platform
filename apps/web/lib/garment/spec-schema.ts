import { z } from "zod";
import {
  artworkSchema,
  colourwaySchema,
  fabricSchema,
  measurementSchema,
  optionChoiceSchema,
  panelFabricSchema,
  sizingSchema,
} from "./parts";
import { kebabId, wearerSchema } from "./primitives";
import { LIST_LIMITS, specProblems } from "./spec-checks";

export const SPEC_SCHEMA_VERSION = 4;

/** Sanity limits on list sizes, so one spec cannot grow without bound. */
export const MAX_MEASUREMENTS = 64;
export const MAX_COLOURWAYS = LIST_LIMITS.colourways;
export const MAX_ARTWORK = 48;
export const MAX_FABRICS = LIST_LIMITS.fabrics;
export const MAX_PANEL_FABRICS = 32;

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
    /** Never empty. Panels with no entry in `panelFabrics` use the first. */
    fabrics: z.tuple([fabricSchema], fabricSchema).readonly(),
    panelFabrics: z.array(panelFabricSchema).max(MAX_PANEL_FABRICS).readonly(),
    /** Never empty. */
    colourways: z.tuple([colourwaySchema], colourwaySchema).readonly(),
    artwork: z.array(artworkSchema).max(MAX_ARTWORK).readonly(),
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
