import { z } from "zod";
import { pointSchema } from "./pieces";

const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64);

export const ZONE_PURPOSES = [
  "crest",
  "sponsor",
  "front-number",
  "back-name",
  "back-number",
  "sleeve-badge",
  "sleeve-band",
] as const;

/** A place on one piece where a mark may go, per size, in that piece's millimetre coordinates. */
export const printZoneSchema = z.object({
  id: idSchema,
  pieceId: idSchema,
  purpose: z.enum(ZONE_PURPOSES),
  polygonBySize: z.record(z.string(), z.array(pointSchema).min(3).max(500)),
  clearSpaceMm: z.number().finite().min(0).max(200),
});
export type PrintZone = z.output<typeof printZoneSchema>;

/** A setting the code needs to run is a default, labelled so, never a measurement. */
export const DEFAULT_LABEL = "Knitwright default, not from your print house";

export const printProfileSchema = z.object({
  bleedMm: z.number().finite().min(0).max(100),
  dpi: z.number().int().min(72).max(1200),
  /** The stored file of the print house's ICC profile, when the brand has uploaded one. */
  iccFileId: z.uuid().nullable(),
  maxPrintWidthMm: z.number().finite().positive().max(10_000).nullable(),
  /** Where bleed and dpi came from: "print-house" or the default label above. */
  source: z.enum(["print-house", "knitwright-default"]),
});
export type PrintProfile = z.output<typeof printProfileSchema>;

export const printRuleSetSchema = z.object({
  minTextHeightMm: z.number().finite().positive().max(1000).nullable(),
  minLineMm: z.number().finite().positive().max(100).nullable(),
  coloursToAvoid: z.array(z.string().regex(/^#[0-9a-f]{6}$/)).max(50),
  numberRules: z
    .object({
      minHeightMm: z.number().finite().positive(),
      maxHeightMm: z.number().finite().positive(),
      allowedDigits: z.string().regex(/^[0-9]{1,3}$/).nullable(),
      source: z.string().min(1).max(200),
    })
    .nullable(),
});
export type PrintRuleSet = z.output<typeof printRuleSetSchema>;

export const PRINT_FORMATS = ["pdf", "svg", "tiff"] as const;

export const printFileSpecSchema = z.object({
  pieceId: idSchema,
  size: z.string().min(1).max(16),
  playerNumber: z.string().regex(/^[0-9]{1,3}$/).optional(),
  format: z.enum(PRINT_FORMATS),
  bleedMm: z.number().finite().min(0),
  scaleX: z.number().finite().positive(),
  scaleY: z.number().finite().positive(),
  dpi: z.number().int().min(72).max(1200),
  profile: printProfileSchema,
});
export type PrintFileSpec = z.output<typeof printFileSpecSchema>;

export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const printFileResultSchema = z.object({
  sha256: sha256Schema,
  pageWidthMm: z.number().finite().positive(),
  pageHeightMm: z.number().finite().positive(),
  warnings: z.array(z.string().min(1).max(300)).max(50),
});
export type PrintFileResult = z.output<typeof printFileResultSchema>;

/**
 * What the print workstream offers the release workstream, so releases can hash files before
 * the real builder exists. Implementations must be deterministic.
 */
export interface PrintFileBuilder {
  build(spec: PrintFileSpec): Promise<PrintFileResult & { readonly bytes: Uint8Array }>;
}
