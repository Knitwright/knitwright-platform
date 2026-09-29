import { z } from "zod";

/** The rows of the two project tables, as the database returns them. Checked where read. */

export const PROJECT_COLUMNS =
  "id, name, style_number, season, garment_type, current_version, created_at, updated_at";

export const projectRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  style_number: z.string(),
  season: z.string(),
  garment_type: z.string(),
  current_version: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

export const VERSION_COLUMNS = "version, note, restored_from, created_at";

export const versionRowSchema = z.object({
  version: z.number().int().min(1),
  note: z.string(),
  restored_from: z.number().int().min(1).nullable(),
  created_at: z.string(),
});

export const versionWithSpecRowSchema = versionRowSchema.extend({ spec: z.unknown() });
