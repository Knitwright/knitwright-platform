import type { SpecAction } from "./action-schema";
import type { ActionResult } from "./apply-action";
import type { GarmentSpec } from "./spec-schema";
import type { Labelling } from "./tech-parts";

/**
 * The changes to what only the tech pack needs: components, construction and labelling.
 * Each returns a new design or a plain reason. The design is checked by `applyAction` after.
 */

const accept = (spec: GarmentSpec): ActionResult => ({ ok: true, spec, dropped: [] });
const reject = (reason: string): ActionResult => ({ ok: false, reason });

/** Adds an entry, or replaces the one with the same key. */
const upsert = <T>(list: readonly T[], item: T, same: (entry: T) => boolean): readonly T[] =>
  list.some(same) ? list.map((entry) => (same(entry) ? item : entry)) : [...list, item];

export function setComponent(spec: GarmentSpec, component: GarmentSpec["components"][number]): ActionResult {
  return accept({ ...spec, components: upsert(spec.components, component, (entry) => entry.id === component.id) });
}

export function removeComponent(spec: GarmentSpec, id: string): ActionResult {
  if (!spec.components.some((entry) => entry.id === id)) return reject(`There is no component with the id ${id}.`);
  return accept({ ...spec, components: spec.components.filter((entry) => entry.id !== id) });
}

export function setConstruction(spec: GarmentSpec, entry: GarmentSpec["construction"][number]): ActionResult {
  return accept({ ...spec, construction: upsert(spec.construction, entry, (found) => found.seamId === entry.seamId) });
}

export function removeConstruction(spec: GarmentSpec, seamId: string): ActionResult {
  if (!spec.construction.some((entry) => entry.seamId === seamId)) {
    return reject(`There is no construction entry for ${seamId}.`);
  }
  return accept({ ...spec, construction: spec.construction.filter((entry) => entry.seamId !== seamId) });
}

type SetLabelling = Extract<SpecAction, { type: "set-labelling" }>;

/** Sets one labelling field. Empty text takes the field out. */
export function setLabelling(spec: GarmentSpec, action: SetLabelling): ActionResult {
  const { [action.field]: removed, ...others } = spec.labelling;
  void removed;
  const labelling: Labelling =
    action.text === "" ? others : { ...others, [action.field]: { text: action.text, provenance: action.provenance } };
  return accept({ ...spec, labelling });
}
