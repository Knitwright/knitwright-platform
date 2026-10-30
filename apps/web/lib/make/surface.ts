import type { GarmentSpec } from "@/lib/garment/spec-schema";

/**
 * Whether one saved version of a design differs from another only on its surface (F-S7: "a run requires an approved
 * golden sample of that design version, or of a parent version that differs only in surface").
 *
 * A golden sample is evidence about a made garment: how it fits, how it was sewn, how its colour came out. Change the
 * print over the same blocks, in the same fabric, at the same measurements, and that evidence still describes the
 * garment. Change anything the factory cuts or sews to, and it does not.
 *
 * Every top-level field of the design is named below. A field this file does not know is structural, so a field added
 * to the design later can never quietly carry a sign-off forward; `surface.test.ts` holds the lists against a real
 * design so a new field shows up as a failing test.
 */

/** The fields that only change what is printed or stitched on top of the garment. */
export const SURFACE_FIELDS: readonly string[] = ["colourways", "artwork", "kitPattern", "namesAndNumbers", "artworkStack"];

/** The fields that change what the factory cuts, sews, or measures. */
export const STRUCTURAL_FIELDS: readonly string[] = [
  "schemaVersion",
  "typeId",
  "wearer",
  "options",
  "sizing",
  "measurements",
  "sizeMeasurements",
  "tolerances",
  "fabrics",
  "panelFabrics",
  "components",
  "construction",
  "labelling",
  "article",
];

export type FieldGroup = "surface" | "structural";
export type ChangedField = Readonly<{ field: string; group: FieldGroup }>;

/** Surface only where this file says so; everything else, known or not, is structural. */
export const groupOf = (field: string): FieldGroup => (SURFACE_FIELDS.includes(field) ? "surface" : "structural");

/** Key order never matters: two designs that hold the same values are the same design. */
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, inner]) => inner !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(",")}}`;
};

type Fields = Readonly<Record<string, unknown>>;

/** Every top-level field whose value differs, with the group it belongs to, in field-name order. */
export function changedFields(parent: GarmentSpec, child: GarmentSpec): readonly ChangedField[] {
  const left = parent as unknown as Fields;
  const right = child as unknown as Fields;
  const names = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort((a, b) => a.localeCompare(b));
  return names.filter((field) => canonical(left[field]) !== canonical(right[field])).map((field) => ({ field, group: groupOf(field) }));
}

export type SurfaceVerdict =
  | Readonly<{ status: "same"; changed: readonly ChangedField[] }>
  | Readonly<{ status: "surface-only"; changed: readonly ChangedField[] }>
  | Readonly<{ status: "structural"; changed: readonly ChangedField[] }>;

/** How the child differs from the parent. `changed` is the whole list either way, so a screen can show it. */
export function compareVersions(parent: GarmentSpec, child: GarmentSpec): SurfaceVerdict {
  const changed = changedFields(parent, child);
  if (changed.length === 0) return { status: "same", changed };
  return changed.every((one) => one.group === "surface") ? { status: "surface-only", changed } : { status: "structural", changed };
}

/** "the colourways and the artwork" — the changed fields in words, for a note a person reads. */
export const describeChanged = (changed: readonly ChangedField[]): string => {
  const names = changed.map((one) => one.field);
  if (names.length === 0) return "nothing";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};
