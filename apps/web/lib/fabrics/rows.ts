import { z } from "zod";
import type { FabricProfile } from "@/lib/production/contract";
import type { FabricTest } from "./profile";
import { readStoredProfile } from "./sheet";

const num = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().nullable());

export const fabricRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  composition: z.string(),
  construction: z.string(),
  notes: z.string(),
  profile: z.unknown(),
  created_at: z.string(),
});

export const testRowSchema = z.object({
  id: z.uuid(),
  fabric_id: z.uuid(),
  tested_by: z.string(),
  tested_on: z.string(),
  method: z.string(),
  load_newtons: num,
  stretch_length_pct: num,
  stretch_width_pct: num,
  recovery_pct: num,
  shrink_length_pct: num,
  shrink_width_pct: num,
  press_temp_c: num,
  press_seconds: num,
  reduction_pct: num,
  photo_file_ids: z.array(z.uuid()),
  created_at: z.string(),
});

export const mapRowSchema = z.object({
  label: z.string(),
  wearer: z.enum(["men", "women", "youth"]),
  cut: z.enum(["mens", "womens", "junior", "unisex"]),
  pattern_size: z.string(),
  source: z.enum(["brand-supplied", "user-edited"]),
});

export type StoredFabric = Readonly<{
  id: string;
  name: string;
  composition: string;
  construction: string;
  notes: string;
  /** What the supplier's sheet states. Tested numbers come from `tests`. */
  sheet: FabricProfile;
  tests: readonly FabricTest[];
  createdAt: string;
}>;

export const testFromRow = (row: z.output<typeof testRowSchema>): FabricTest => ({
  id: row.id,
  fabricId: row.fabric_id,
  testedBy: row.tested_by,
  testedOn: row.tested_on,
  method: row.method,
  loadNewtons: row.load_newtons,
  stretchLengthPct: row.stretch_length_pct,
  stretchWidthPct: row.stretch_width_pct,
  recoveryPct: row.recovery_pct,
  shrinkLengthPct: row.shrink_length_pct,
  shrinkWidthPct: row.shrink_width_pct,
  pressTempC: row.press_temp_c,
  pressSeconds: row.press_seconds,
  reductionPct: row.reduction_pct,
  photoFileIds: row.photo_file_ids,
  createdAt: row.created_at,
});

export const fabricFromRow = (row: z.output<typeof fabricRowSchema>, tests: readonly FabricTest[]): StoredFabric => ({
  id: row.id,
  name: row.name,
  composition: row.composition,
  construction: row.construction,
  notes: row.notes,
  sheet: readStoredProfile(row.profile),
  tests: tests.filter((t) => t.fabricId === row.id),
  createdAt: row.created_at,
});
