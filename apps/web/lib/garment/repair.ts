import type { ActionResult } from "./apply-action";
import { retype } from "./reconcile";
import { getType } from "./registry";
import { validateSpec, type GarmentSpec } from "./spec";
import { SPEC_SCHEMA_VERSION, garmentSpecStructureSchema } from "./spec-schema";

/**
 * Brings a design that was valid under older registry data back to valid. Choices that
 * are no longer offered go back to the type's default, marked derived, and anything that
 * no longer fits is removed. It uses the same code as a change of type.
 */
export function repairSpec(spec: GarmentSpec): ActionResult {
  const type = getType(spec.typeId);
  if (!type) return { ok: false, reason: `There is no garment type called ${spec.typeId}.` };
  const tidy = retype(spec, type);
  const checked = validateSpec(tidy.value);
  return checked.ok
    ? { ok: true, spec: checked.spec, dropped: tidy.dropped }
    : { ok: false, reason: checked.issues.join(" ") };
}

export type MigrateResult =
  | {
      readonly ok: true;
      readonly spec: GarmentSpec;
      /** True when the design no longer fits the registry. Pass it to `repairSpec`. */
      readonly stale: boolean;
    }
  | { readonly ok: false; readonly reason: string };

/** Turns a stored design of version n into version n + 1. */
export type Upgrade = (input: Record<string, unknown>) => Record<string, unknown>;

/**
 * One entry per old version, keyed by the version it upgrades from. It is empty because
 * no earlier version was ever stored. The next version bump adds its upgrade here.
 */
export const UPGRADES: Readonly<Record<number, Upgrade>> = {};

const NOT_A_DESIGN = "This is not a saved design.";

/** Applies each upgrade in turn until the design is at the current version. */
export function upgradeToCurrent(
  input: Record<string, unknown>,
  upgrades: Readonly<Record<number, Upgrade>>,
  current: number,
): Record<string, unknown> | string {
  let design = input;
  while (design.schemaVersion !== current) {
    const version = design.schemaVersion;
    if (typeof version !== "number" || !Number.isInteger(version)) return NOT_A_DESIGN;
    if (version > current) {
      return `This design was saved by a newer version of the app, version ${version}, and cannot be opened here.`;
    }
    const upgrade = upgrades[version];
    if (!upgrade) {
      return `This design was saved in an older format, version ${version}, which can no longer be opened.`;
    }
    design = { ...upgrade(design), schemaVersion: version + 1 };
  }
  return design;
}

/**
 * Reads a stored design of any known version and returns the current version, or a plain
 * reason. It checks the shape only. A design that no longer fits the registry comes back
 * with `stale` set, ready for `repairSpec`.
 */
export function migrateSpec(input: unknown): MigrateResult {
  if (typeof input !== "object" || input === null || Array.isArray(input) || !("schemaVersion" in input)) {
    return { ok: false, reason: NOT_A_DESIGN };
  }
  const upgraded = upgradeToCurrent({ ...input } as Record<string, unknown>, UPGRADES, SPEC_SCHEMA_VERSION); // a plain object copy
  if (typeof upgraded === "string") return { ok: false, reason: upgraded };
  const parsed = garmentSpecStructureSchema.safeParse(upgraded);
  if (!parsed.success) {
    return { ok: false, reason: `This design is damaged and cannot be opened. ${parsed.error.issues[0]?.message ?? ""}`.trim() };
  }
  return { ok: true, spec: parsed.data, stale: !validateSpec(parsed.data).ok };
}
