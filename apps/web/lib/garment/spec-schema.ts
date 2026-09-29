import { z } from "zod";
import {
  artworkSchema,
  colourwaySchema,
  fabricSchema,
  measurementSchema,
  panelFabricSchema,
} from "./parts";
import { kebabId, wearerSchema } from "./primitives";
import { specProblems } from "./spec-checks";

export const SPEC_SCHEMA_VERSION = 2;

/** Sanity limits on list sizes, so one spec cannot grow without bound. */
export const MAX_MEASUREMENTS = 64;
export const MAX_COLOURWAYS = 24;
export const MAX_ARTWORK = 48;
export const MAX_FABRICS = 16;
export const MAX_PANEL_FABRICS = 32;

/**
 * The whole design of one garment. It holds only what a person or the assistant chose.
 * Anything that can be worked out, such as the list of panels, is left out. Unknown
 * keys are refused so nothing derived can be stored by mistake.
 */
export const garmentSpecSchema = z
  .strictObject({
    schemaVersion: z.literal(SPEC_SCHEMA_VERSION),
    typeId: kebabId,
    wearer: wearerSchema,
    /** The chosen choice for each option that applies, keyed by option id. */
    options: z.record(kebabId, kebabId).readonly(),
    measurements: z.array(measurementSchema).max(MAX_MEASUREMENTS).readonly(),
    fabrics: z.array(fabricSchema).min(1, "Keep at least one fabric.").max(MAX_FABRICS).readonly(),
    /** Panels with no entry use the first fabric. */
    panelFabrics: z.array(panelFabricSchema).max(MAX_PANEL_FABRICS).readonly(),
    colourways: z.array(colourwaySchema).min(1, "Keep at least one colourway.").max(MAX_COLOURWAYS).readonly(),
    artwork: z.array(artworkSchema).max(MAX_ARTWORK).readonly(),
  })
  .superRefine((spec, context) => {
    for (const found of specProblems(spec)) {
      context.addIssue({ code: "custom", message: found.message, path: [...found.path] });
    }
  })
  .readonly();

export type GarmentSpec = z.output<typeof garmentSpecSchema>;
