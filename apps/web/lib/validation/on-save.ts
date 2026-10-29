import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarmentSpec } from "@/lib/garment";
import { log } from "@/lib/server/log";
import { UNWIRED_PORTS, type ValidationPorts } from "./ports";
import { writeValidationResult } from "./results";
import { loadFactoryProfile } from "./service";
import { specInput, standardRegistry } from "./spec-input";
import { validateDesign, type ValidationResult } from "./validate";

export interface SavedVersion {
  readonly brandId: string;
  readonly userId: string;
  readonly projectId: string;
  readonly version: number;
  readonly spec: GarmentSpec;
}

/** Where a failure is written. The default is the server log; a test passes its own. */
export type SaveLog = (event: Readonly<{ level: "warn"; message: string; where: string; error: unknown }>) => void;

/**
 * Runs validation on a version that was just saved and stores the checks (spec F-0: "runs on every save"). The save has
 * already happened, so a failure here never undoes it: it is logged, and the next save or a status move runs the checks again.
 * The readiness list of the tech pack is not built here (it reads the whole tech pack); it runs when a status is recorded.
 */
export async function validateOnSave(
  admin: SupabaseClient,
  saved: SavedVersion,
  ports: ValidationPorts = UNWIRED_PORTS,
  write: SaveLog = log,
): Promise<ValidationResult | null> {
  try {
    const [profile, extra] = await Promise.all([loadFactoryProfile(admin), specInput(saved.spec, saved.brandId, ports)]);
    const result = validateDesign({ typeId: saved.spec.typeId, readiness: null, ...extra }, profile, standardRegistry());
    await writeValidationResult(admin, saved, { projectId: saved.projectId, version: saved.version, profileId: profile.id, scope: "save", checks: result.checks });
    return result;
  } catch (error) {
    write({ level: "warn", message: `The checks could not be run for version ${saved.version} of this design.`, where: "validation on save", error });
    return null;
  }
}
