import { fabricProfileSchema, type FabricProfile, type FabricValue } from "@/lib/production/contract";
import { EMPTY_PROFILE } from "./profile";
import type { SupplierSheet } from "./schemas";

const fromSheet = (value: number | undefined): FabricValue =>
  value === undefined ? { value: null, source: "not-set" } : { value, source: "supplier-sheet" };

/** A supplier's sheet as a profile: what it states is "supplier sheet", the rest "not set". */
export const profileFromSheet = (sheet: SupplierSheet): FabricProfile => ({
  stretchLengthPct: fromSheet(sheet.stretchLengthPct),
  stretchWidthPct: fromSheet(sheet.stretchWidthPct),
  recoveryPct: fromSheet(sheet.recoveryPct),
  shrinkLengthPct: fromSheet(sheet.shrinkLengthPct),
  shrinkWidthPct: fromSheet(sheet.shrinkWidthPct),
  gsm: fromSheet(sheet.gsm),
  usableWidthMm: fromSheet(sheet.usableWidthMm),
});

/** A stored profile read back, or an empty one when what is stored is not a profile. */
export function readStoredProfile(raw: unknown): FabricProfile {
  const parsed = fabricProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_PROFILE;
}
