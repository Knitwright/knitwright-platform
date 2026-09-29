import { panelsFor, type SpecShape } from "./applicability";
import { conditionsHold } from "./conditions";
import type { ComponentSlot, SeamClass, StitchClass } from "./definitions";
import { panelName } from "./labels";
import { getType } from "./registry";
import { SEAM_CLASSES, STITCH_CLASSES } from "./registry/construction-classes";

/** The stitch types (ISO 4915) a design can name. Copies, so the catalogue cannot be changed. */
export const listStitchClasses = (): readonly StitchClass[] => [...STITCH_CLASSES];

/** The seam classes (ISO 4916) a design can name. */
export const listSeamClasses = (): readonly SeamClass[] => [...SEAM_CLASSES];

export const stitchClassById = (id: string): StitchClass | undefined =>
  STITCH_CLASSES.find((entry) => entry.id === id);

export const seamClassById = (id: string): SeamClass | undefined => SEAM_CLASSES.find((entry) => entry.id === id);

/** A seam of a design, with the classes the registry rule proposes and the panels it joins by name. */
export interface ResolvedSeam {
  readonly id: string;
  readonly label: string;
  readonly panels: readonly { readonly id: string; readonly label: string }[];
  readonly seamClass: SeamClass;
  readonly stitchClass: StitchClass;
}

/**
 * The seams this design has, in registry order, each with the seam class and stitch class the
 * registry proposes. A seam applies when its conditions hold, none of its exclusions hold, and
 * every panel it joins is on the garment. An unknown type has none.
 */
export function seamsFor(spec: SpecShape): readonly ResolvedSeam[] {
  const type = getType(spec.typeId);
  if (!type) return [];
  const present = new Set(panelsFor(spec).map((panel) => panel.id));
  return type.seams.flatMap((seam) => {
    const applies =
      conditionsHold(seam.appliesWhen, spec.options) &&
      !(seam.unlessWhen.length > 0 && conditionsHold(seam.unlessWhen, spec.options)) &&
      seam.panels.every((id) => present.has(id));
    const seamClass = seamClassById(seam.seamClass);
    const stitchClass = stitchClassById(seam.stitchClass);
    if (!applies || !seamClass || !stitchClass) return [];
    return [
      {
        id: seam.id,
        label: seam.label,
        panels: seam.panels.map((id) => ({ id, label: panelName(type, id) })),
        seamClass,
        stitchClass,
      },
    ];
  });
}

/** The components this design implies, in registry order. An unknown type has none. */
export function componentSlotsFor(spec: SpecShape): readonly ComponentSlot[] {
  const type = getType(spec.typeId);
  if (!type) return [];
  return type.components.filter((slot) => conditionsHold(slot.appliesWhen, spec.options));
}
