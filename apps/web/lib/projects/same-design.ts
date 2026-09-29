import type { GarmentSpec } from "@/lib/garment";

/** Whether two plain values hold the same thing. Key order does not matter. */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
};

const byKey = <T>(list: readonly T[], key: (item: T) => string): T[] =>
  [...list].sort((x, y) => key(x).localeCompare(key(y)));

/** Lists whose order carries no meaning are put in a fixed order before comparing. */
const normalised = (spec: GarmentSpec) => ({
  ...spec,
  measurements: byKey(spec.measurements, (entry) => entry.pointId),
  panelFabrics: byKey(spec.panelFabrics, (entry) => entry.panelId),
});

/** Whether two designs are the same design, whatever order their measurements were added in. */
export const sameDesign = (a: GarmentSpec, b: GarmentSpec): boolean => deepEqual(normalised(a), normalised(b));
