import { specActionSchema, type SpecAction } from "./action-schema";
import type { Artwork, Colourway, FabricSpec } from "./parts";
import { carryOptions, reconcile, repairClashes } from "./reconcile";
import { getType } from "./registry";
import { validateSpec, type GarmentSpec } from "./spec";

export type ActionResult =
  | { readonly ok: true; readonly spec: GarmentSpec; readonly dropped: readonly string[] }
  | { readonly ok: false; readonly reason: string };

const accept = (spec: GarmentSpec, dropped: readonly string[] = []): ActionResult => ({
  ok: true,
  spec,
  dropped,
});
const reject = (reason: string): ActionResult => ({ ok: false, reason });

/** Replaces the entry with the same id, or adds it at the end. */
function upsert<T extends { readonly id: string }>(list: readonly T[], item: T): readonly T[] {
  return list.some((entry) => entry.id === item.id)
    ? list.map((entry) => (entry.id === item.id ? item : entry))
    : [...list, item];
}

function setOption(spec: GarmentSpec, optionId: string, choiceId: string): ActionResult {
  const type = getType(spec.typeId);
  if (!type) return reject(`There is no garment type called ${spec.typeId}.`);
  const changed = { ...spec, options: { ...spec.options, [optionId]: choiceId } };
  const tidy = reconcile(changed, type);
  return accept(tidy.value, tidy.dropped);
}

function changeType(spec: GarmentSpec, typeId: string): ActionResult {
  const type = getType(typeId);
  if (!type) return reject(`There is no garment type called ${typeId}.`);
  const carried = carryOptions(spec.options, type);
  const repaired = repairClashes(carried.value, type);
  const tidy = reconcile({ ...spec, typeId, options: repaired.value }, type);
  return accept(tidy.value, [...carried.dropped, ...repaired.dropped, ...tidy.dropped]);
}

function setMeasurement(spec: GarmentSpec, action: Extract<SpecAction, { type: "set-measurement" }>): ActionResult {
  const entry = { pointId: action.pointId, value: action.value, provenance: action.provenance };
  const known = spec.measurements.some((measurement) => measurement.pointId === entry.pointId);
  const measurements = known
    ? spec.measurements.map((measurement) => (measurement.pointId === entry.pointId ? entry : measurement))
    : [...spec.measurements, entry];
  return accept({ ...spec, measurements });
}

function removeMeasurement(spec: GarmentSpec, pointId: string): ActionResult {
  if (!spec.measurements.some((measurement) => measurement.pointId === pointId)) {
    return reject(`There is no measurement for ${pointId} to remove.`);
  }
  return accept({ ...spec, measurements: spec.measurements.filter((entry) => entry.pointId !== pointId) });
}

function colourwayAction(spec: GarmentSpec, kind: "add" | "update", colourway: Colourway): ActionResult {
  if (kind === "add") return accept({ ...spec, colourways: [...spec.colourways, colourway] });
  if (!spec.colourways.some((entry) => entry.id === colourway.id)) {
    return reject(`There is no colourway with the id ${colourway.id}.`);
  }
  return accept({ ...spec, colourways: upsert(spec.colourways, colourway) });
}

function artworkAction(spec: GarmentSpec, kind: "add" | "update", artwork: Artwork): ActionResult {
  if (kind === "add") return accept({ ...spec, artwork: [...spec.artwork, artwork] });
  if (!spec.artwork.some((entry) => entry.id === artwork.id)) {
    return reject(`There is no artwork with the id ${artwork.id}.`);
  }
  return accept({ ...spec, artwork: upsert(spec.artwork, artwork) });
}

function fabricAction(spec: GarmentSpec, kind: "add" | "update", fabric: FabricSpec): ActionResult {
  if (kind === "add") return accept({ ...spec, fabrics: [...spec.fabrics, fabric] });
  if (!spec.fabrics.some((entry) => entry.id === fabric.id)) {
    return reject(`There is no fabric with the id ${fabric.id}.`);
  }
  return accept({ ...spec, fabrics: upsert(spec.fabrics, fabric) });
}

/** Removes a fabric. Panels that used it go back to the first fabric and are reported. */
function removeFabric(spec: GarmentSpec, id: string): ActionResult {
  const fabric = spec.fabrics.find((entry) => entry.id === id);
  if (!fabric) return reject(`There is no fabric with the id ${id}.`);
  const used = spec.panelFabrics.filter((entry) => entry.fabricId === id);
  const dropped = used.map(
    (entry) => `The panel ${entry.panelId} went back to the first fabric, because ${fabric.name} was removed.`,
  );
  return accept(
    {
      ...spec,
      fabrics: spec.fabrics.filter((entry) => entry.id !== id),
      panelFabrics: spec.panelFabrics.filter((entry) => entry.fabricId !== id),
    },
    dropped,
  );
}

function assignFabric(spec: GarmentSpec, panelId: string, fabricId: string): ActionResult {
  const others = spec.panelFabrics.filter((entry) => entry.panelId !== panelId);
  return accept({ ...spec, panelFabrics: [...others, { panelId, fabricId }] });
}

function removeById(spec: GarmentSpec, list: "colourways" | "artwork", id: string): ActionResult {
  const label = list === "colourways" ? "colourway" : "artwork";
  if (!spec[list].some((entry) => entry.id === id)) return reject(`There is no ${label} with the id ${id}.`);
  return accept({ ...spec, [list]: spec[list].filter((entry) => entry.id !== id) });
}

function run(spec: GarmentSpec, action: SpecAction): ActionResult {
  switch (action.type) {
    case "set-option":
      return setOption(spec, action.optionId, action.choiceId);
    case "set-measurement":
      return setMeasurement(spec, action);
    case "remove-measurement":
      return removeMeasurement(spec, action.pointId);
    case "add-fabric":
      return fabricAction(spec, "add", action.fabric);
    case "update-fabric":
      return fabricAction(spec, "update", action.fabric);
    case "remove-fabric":
      return removeFabric(spec, action.id);
    case "assign-fabric":
      return assignFabric(spec, action.panelId, action.fabricId);
    case "add-colourway":
      return colourwayAction(spec, "add", action.colourway);
    case "update-colourway":
      return colourwayAction(spec, "update", action.colourway);
    case "remove-colourway":
      return removeById(spec, "colourways", action.id);
    case "add-artwork":
      return artworkAction(spec, "add", action.artwork);
    case "update-artwork":
      return artworkAction(spec, "update", action.artwork);
    case "remove-artwork":
      return removeById(spec, "artwork", action.id);
    case "change-wearer":
      return accept({ ...spec, wearer: action.wearer });
    case "change-type":
      return changeType(spec, action.typeId);
  }
}

/**
 * Applies one change to a design and returns the new design, or a plain reason why not.
 * The input is never changed. The result is always checked, so an invalid design is
 * never returned. Anything that no longer fits after the change is removed and listed
 * in `dropped`. The action may be any value, since it can come from a person or a model.
 */
export function applyAction(spec: GarmentSpec, action: unknown): ActionResult {
  const parsed = specActionSchema.safeParse(action);
  if (!parsed.success) return reject("That change is not understood.");
  const outcome = run(spec, parsed.data);
  if (!outcome.ok) return outcome;
  const checked = validateSpec(outcome.spec);
  if (!checked.ok) return reject(checked.issues.join(" "));
  return accept(checked.spec, outcome.dropped);
}
