import type { ActionResult } from "./apply-action";
import { fabricSchema } from "./parts";
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
type Upgrade = (input: Record<string, unknown>) => Record<string, unknown>;

/** Version 4 becomes 5: empty tech pack fields and an empty fabric consumption. Nothing is guessed. */
function addTechPackFields(input: Record<string, unknown>): Record<string, unknown> {
  const fabrics = Array.isArray(input.fabrics)
    ? input.fabrics.map((fabric: unknown) =>
        typeof fabric === "object" && fabric !== null ? { consumption: "", ...fabric } : fabric,
      )
    : input.fabrics;
  return {
    ...input,
    fabrics,
    components: input.components ?? [],
    construction: input.construction ?? [],
    labelling: input.labelling ?? {},
  };
}

/** Version 5 becomes 6: the old source of a fabric is copied onto each field that has a value. */
function addFabricSources(input: Record<string, unknown>): Record<string, unknown> {
  const fabrics = Array.isArray(input.fabrics)
    ? input.fabrics.map((fabric: unknown) => {
        if (typeof fabric !== "object" || fabric === null) return fabric;
        const parsed = fabricSchema.safeParse(fabric);
        return parsed.success ? parsed.data : fabric;
      })
    : input.fabrics;
  return { ...input, fabrics };
}

/**
 * One entry per old version, keyed by the version it upgrades from. Versions before 3
 * were never stored. Version 3 becomes 4 by adding the optional colour swatch, which needs
 * nothing written into a stored design. Version 4 becomes 5 with the tech pack fields, and 5 becomes 6 with a source for each fabric field.
 * The next version bump adds its upgrade here.
 */
const UPGRADES: Readonly<Record<number, Upgrade>> = {
  3: (input) => ({ ...input }),
  4: addTechPackFields,
  5: addFabricSources,
};

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
