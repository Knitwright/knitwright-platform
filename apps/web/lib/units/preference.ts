import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { LENGTH_UNITS, UNIT_NAMES, type LengthUnit } from "@/lib/techpack/view/units";
import type { LengthUnit as CmOrIn } from "./length";

/**
 * The unit a person reads garment lengths in (spec 09 screen 19 "Units (mm default for garments)",
 * plan v6 P6, decision 0144). Stored per person in `person_preferences`; no row is millimetres.
 *
 * This is the one helper the measurement and size-guide components read the preference through:
 * the server reads it here (`readLengthUnit`), the shell hands it down, and a client component asks
 * `usePreferredLengthUnit` (components/units). Nothing stored in a design depends on it: every length
 * is kept in millimetres or centimetres and only the reading changes.
 */

export const GARMENT_UNITS = LENGTH_UNITS;
export type GarmentUnit = LengthUnit;
export const DEFAULT_GARMENT_UNIT: GarmentUnit = "mm";

/** What Settings says about each unit. */
export const GARMENT_UNIT_LABELS: Readonly<Record<GarmentUnit, string>> = {
  mm: `Millimetres (mm)`,
  cm: `Centimetres (cm)`,
  in: `Inches (in)`,
};

/** "Millimetres for garments · px for social", Settings' summary line. */
export const unitSummary = (unit: GarmentUnit): string =>
  `${UNIT_NAMES[unit].charAt(0).toUpperCase()}${UNIT_NAMES[unit].slice(1)} for garments · px for social`;

/** A stored or posted value as a unit; anything else is the default. */
export const garmentUnitFrom = (value: unknown): GarmentUnit =>
  GARMENT_UNITS.find((unit) => unit === value) ?? DEFAULT_GARMENT_UNIT;

/** For a view that reads only centimetres or inches (the guided flow): millimetres read as centimetres. */
export const toCmOrIn = (unit: GarmentUnit): CmOrIn => (unit === "in" ? "in" : "cm");

const NOT_SAVED = "Your unit could not be saved. Try again.";

/** The person's unit, read with their own client so row security answers. A failed read is the default. */
export async function readLengthUnit(client: SupabaseClient, userId: string): Promise<GarmentUnit> {
  const { data, error } = await client.from("person_preferences").select("length_unit").eq("user_id", userId).maybeSingle();
  if (error || !data) return DEFAULT_GARMENT_UNIT;
  return garmentUnitFrom((data as { length_unit: unknown }).length_unit);
}

/** Keeps the person's unit, through the server's own function. */
export async function saveLengthUnit(admin: Pick<SupabaseClient, "rpc">, userId: string, unit: GarmentUnit): Promise<void> {
  const { error } = await admin.rpc("set_length_unit", { p_user_id: userId, p_unit: unit });
  if (error) throw new AppError("internal", NOT_SAVED, undefined, { cause: error });
}
