import { z } from "zod";
import { printRuleSetSchema } from "@/lib/production/contract";
import type { LeagueRuleSet, StoredPrintProfile } from "./schemas";

export const profileRowSchema = z.object({
  bleed_mm: z.coerce.number(),
  dpi: z.number().int(),
  min_dpi: z.number().int(),
  icc_file_id: z.uuid().nullable(),
  max_print_width_mm: z.coerce.number().nullable(),
  source: z.enum(["print-house", "knitwright-default"]),
});

export const ruleRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  source: z.string(),
  rules: printRuleSetSchema,
  updated_at: z.string(),
});

export const profileFromRow = (row: z.output<typeof profileRowSchema>): StoredPrintProfile => ({
  bleedMm: row.bleed_mm,
  dpi: row.dpi,
  minDpi: row.min_dpi,
  iccFileId: row.icc_file_id,
  maxPrintWidthMm: row.max_print_width_mm,
  source: row.source,
});

export const ruleSetFromRow = (row: z.output<typeof ruleRowSchema>): LeagueRuleSet => ({
  id: row.id,
  name: row.name,
  source: row.source,
  rules: row.rules,
  updatedAt: row.updated_at,
});
