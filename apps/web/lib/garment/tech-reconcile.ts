import { componentSlotsFor, seamsFor } from "./construction";
import type { Dropped } from "./dropped";
import type { ResolvedType } from "./registry";
import type { GarmentSpec } from "./spec-schema";

/**
 * Removes the components and construction entries that no longer fit the design, for
 * example the details of buttons after the placket became a zip. Each one removed is
 * reported, so the screen can say so.
 */
export function dropStaleTechFields(
  spec: GarmentSpec,
  type: ResolvedType,
): { readonly value: GarmentSpec; readonly dropped: readonly Dropped[] } {
  const slots = new Set(componentSlotsFor(spec).map((slot) => slot.id));
  const seams = new Set(seamsFor(spec).map((seam) => seam.id));
  const dropped: Dropped[] = [];
  const components = spec.components.filter((entry) => {
    if (slots.has(entry.id)) return true;
    const label = type.components.find((slot) => slot.id === entry.id)?.label ?? entry.id;
    dropped.push({
      kind: "component",
      id: entry.id,
      message: `The details for ${label} were removed, because this garment no longer has them.`,
    });
    return false;
  });
  const construction = spec.construction.filter((entry) => {
    if (seams.has(entry.seamId)) return true;
    const label = type.seams.find((seam) => seam.id === entry.seamId)?.label ?? entry.seamId;
    dropped.push({
      kind: "construction",
      id: entry.seamId,
      message: `The stitch details for ${label} were removed, because this garment no longer has that seam.`,
    });
    return false;
  });
  return { value: { ...spec, components, construction }, dropped };
}
