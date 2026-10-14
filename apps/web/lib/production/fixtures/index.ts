import { z } from "zod";
import {
  gradedPatternSchema,
  teamOrderSchema,
  type GradedPattern,
  type TeamOrder,
} from "../contract";
import jerseyJson from "./jersey-eu48.pieces.json";
import designJson from "./polka-jersey.design.json";
import rosterJson from "./roster-22.json";
import teeJson from "./tee-eu48.pieces.json";

/**
 * The benchmark pieces, converted once from the fashionINSTA DXFs in
 * docs/owner/reference/fashioninsta-2026-10-14/ (millimetres, size 48, DXF axes kept).
 * The pattern library's reader must reproduce these exactly.
 */
export const TEE_EU48: GradedPattern = gradedPatternSchema.parse(teeJson);
export const JERSEY_EU48: GradedPattern = gradedPatternSchema.parse(jerseyJson);

/** The benchmark polka-dot jersey, as the numbers its brief gives. Colour names are plain words, not codes. */
const designSchema = z.object({
  name: z.string(),
  garment: z.string(),
  size: z.string(),
  baseColour: z.string(),
  kitPattern: z.object({
    style: z.literal("dots"),
    diameterMm: z.number(),
    pitchMm: z.number(),
    rowStepMm: z.number(),
    halfDrop: z.boolean(),
    rowColours: z.object({ A: z.string(), B: z.string() }),
    clearSpaceMm: z.number(),
  }),
  colours: z.array(z.object({ id: z.string(), role: z.string(), name: z.string() })),
  marks: z.array(z.record(z.string(), z.unknown())),
  trims: z.record(z.string(), z.string()),
  technique: z.string(),
});
export type PolkaJerseyDesign = z.output<typeof designSchema>;
export const POLKA_JERSEY_DESIGN: PolkaJerseyDesign = designSchema.parse(designJson);

/** 22 players with fictional names, one with a 14-letter name. All sizes are in the men's run. */
export const ROSTER_22: TeamOrder = teamOrderSchema.parse(rosterJson);
