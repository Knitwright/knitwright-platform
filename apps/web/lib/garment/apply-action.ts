import { specActionSchema, type SpecAction } from "./action-schema";
import type { Dropped } from "./dropped";
import { fabricChanges } from "./fabric-changes";
import { changeFabric } from "./fabric-edit";
import { panelName } from "./labels";
import { withoutKitPattern } from "./kit-pattern";
import { withoutMarks } from "./names-numbers";
import { nonEmpty } from "./non-empty";
import { reconcile, retype } from "./reconcile";
import { getType } from "./registry";
import { validateSpec, type GarmentSpec } from "./spec";
import { removeSizeMeasurement, removeTolerance, setSizeMeasurement, setSizing, setTolerance } from "./size-values";
import { removeComponent, removeConstruction, setComponent, setConstruction, setLabelling } from "./tech-changes";

export type ActionResult =
  | { readonly ok: true; readonly spec: GarmentSpec; readonly dropped: readonly Dropped[] }
  | { readonly ok: false; readonly reason: string };

const accept = (spec: GarmentSpec, dropped: readonly Dropped[] = []): ActionResult => ({
  ok: true,
  spec,
  dropped,
});
const reject = (reason: string): ActionResult => ({ ok: false, reason });

type ListChange<T> =
  | { readonly kind: "add" | "update"; readonly item: T }
  | { readonly kind: "remove"; readonly id: string };

/**
 * Adds, replaces or removes an entry by id. Returns the new list, or a sentence saying
 * why it cannot be done. Adding a repeated id is left for the spec check to refuse.
 */
function changeList<T extends { readonly id: string }>(
  list: readonly T[],
  noun: string,
  change: ListChange<T>,
): readonly T[] | string {
  if (change.kind === "add") return [...list, change.item];
  const id = change.kind === "remove" ? change.id : change.item.id;
  if (!list.some((entry) => entry.id === id)) return `There is no ${noun} with the id ${id}.`;
  if (change.kind === "remove") return list.filter((entry) => entry.id !== id);
  return list.map((entry) => (entry.id === id ? change.item : entry));
}

function setOption(spec: GarmentSpec, action: Extract<SpecAction, { type: "set-option" }>): ActionResult {
  const type = getType(spec.typeId);
  if (!type) return reject(`There is no garment type called ${spec.typeId}.`);
  const choice = { choiceId: action.choiceId, provenance: action.provenance };
  const tidy = reconcile({ ...spec, options: { ...spec.options, [action.optionId]: choice } }, type);
  return accept(tidy.value, tidy.dropped);
}

function changeType(spec: GarmentSpec, typeId: string): ActionResult {
  const type = getType(typeId);
  if (!type) return reject(`There is no garment type called ${typeId}.`);
  const tidy = retype(spec, type);
  return accept(tidy.value, tidy.dropped);
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
    const type = getType(spec.typeId);
    const name = type?.pointsOfMeasure.find((point) => point.id === pointId)?.label ?? pointId;
    return reject(`There is no ${name} measurement to remove.`);
  }
  return accept({ ...spec, measurements: spec.measurements.filter((entry) => entry.pointId !== pointId) });
}

function fabricList(spec: GarmentSpec, change: ListChange<GarmentSpec["fabrics"][number]>): ActionResult {
  const next = changeList(spec.fabrics, "fabric", change);
  if (typeof next === "string") return reject(next);
  const fabrics = nonEmpty(next);
  return fabrics ? accept({ ...spec, fabrics }) : reject("Keep at least one fabric.");
}

function colourwayList(spec: GarmentSpec, change: ListChange<GarmentSpec["colourways"][number]>): ActionResult {
  const next = changeList(spec.colourways, "colourway", change);
  if (typeof next === "string") return reject(next);
  const colourways = nonEmpty(next);
  return colourways ? accept({ ...spec, colourways }) : reject("Keep at least one colourway.");
}

function artworkList(spec: GarmentSpec, change: ListChange<GarmentSpec["artwork"][number]>): ActionResult {
  const next = changeList(spec.artwork, "artwork", change);
  return typeof next === "string" ? reject(next) : accept({ ...spec, artwork: next });
}

/** Removes a fabric. Panels that used it now follow the first fabric, and each is reported. */
function removeFabric(spec: GarmentSpec, id: string): ActionResult {
  const removed = spec.fabrics.find((entry) => entry.id === id);
  if (!removed) return reject(`There is no fabric with the id ${id}.`);
  const remaining = nonEmpty(spec.fabrics.filter((entry) => entry.id !== id));
  if (!remaining) return reject("Keep at least one fabric.");
  const type = getType(spec.typeId);
  const dropped: Dropped[] = spec.panelFabrics
    .filter((entry) => entry.fabricId === id)
    .map((entry) => ({
      kind: "fabric-assignment",
      id: entry.panelId,
      message: `${type ? panelName(type, entry.panelId) : entry.panelId} now uses ${remaining[0].name}, because ${removed.name} was removed.`,
    }));
  const panelFabrics = spec.panelFabrics.filter((entry) => entry.fabricId !== id);
  return accept({ ...spec, fabrics: remaining, panelFabrics }, dropped);
}

function assignFabric(spec: GarmentSpec, panelId: string, fabricId: string): ActionResult {
  const others = spec.panelFabrics.filter((entry) => entry.panelId !== panelId);
  return accept({ ...spec, panelFabrics: [...others, { panelId, fabricId }] });
}

function run(spec: GarmentSpec, action: SpecAction): ActionResult {
  switch (action.type) {
    case "set-option":
      return setOption(spec, action);
    case "set-measurement":
      return setMeasurement(spec, action);
    case "remove-measurement":
      return removeMeasurement(spec, action.pointId);
    case "set-sizing":
      return setSizing(spec, action.sizing);
    case "set-size-measurement":
      return setSizeMeasurement(spec, action.entry);
    case "remove-size-measurement":
      return removeSizeMeasurement(spec, action.pointId, action.size);
    case "set-tolerance":
      return setTolerance(spec, action.entry);
    case "remove-tolerance":
      return removeTolerance(spec, action.pointId);
    case "add-fabric":
      return fabricList(spec, { kind: "add", item: action.fabric });
    case "update-fabric":
      return fabricList(spec, { kind: "update", item: action.fabric });
    case "change-fabric":
      return changeFabric(spec, action.id, action.changes, action.provenance);
    case "remove-fabric":
      return removeFabric(spec, action.id);
    case "assign-fabric":
      return assignFabric(spec, action.panelId, action.fabricId);
    case "add-colourway":
      return colourwayList(spec, { kind: "add", item: action.colourway });
    case "update-colourway":
      return colourwayList(spec, { kind: "update", item: action.colourway });
    case "remove-colourway":
      return colourwayList(spec, { kind: "remove", id: action.id });
    case "add-artwork":
      return artworkList(spec, { kind: "add", item: action.artwork });
    case "update-artwork":
      return artworkList(spec, { kind: "update", item: action.artwork });
    case "remove-artwork":
      return artworkList(spec, { kind: "remove", id: action.id });
    case "set-names-numbers":
      return accept({ ...spec, namesAndNumbers: action.namesAndNumbers });
    case "remove-names-numbers":
      return spec.namesAndNumbers === undefined ? reject("There are no names and numbers to remove.") : accept(withoutMarks(spec));
    case "set-kit-pattern":
      return accept({ ...spec, kitPattern: action.kitPattern });
    case "remove-kit-pattern":
      return spec.kitPattern === undefined ? reject("There is no kit pattern to remove.") : accept(withoutKitPattern(spec));
    case "set-component":
      return setComponent(spec, action.component);
    case "remove-component":
      return removeComponent(spec, action.id);
    case "set-construction":
      return setConstruction(spec, action.entry);
    case "remove-construction":
      return removeConstruction(spec, action.seamId);
    case "set-labelling":
      return setLabelling(spec, action);
    case "change-wearer":
      return accept({ ...spec, wearer: action.wearer });
    case "change-type":
      return changeType(spec, action.typeId);
  }
}

/**
 * Applies one change to a design and returns the new design, or a plain reason why not.
 * The input is never changed. The result is always checked, so an invalid design is
 * never returned. Anything removed or reset along the way is listed in `dropped`,
 * including any panel that now uses a different fabric without being asked to. The
 * action may be any value, since it can come from a person or a model.
 */
export function applyAction(spec: GarmentSpec, action: unknown): ActionResult {
  const parsed = specActionSchema.safeParse(action);
  if (!parsed.success) return reject("That change is not understood.");
  const outcome = run(spec, parsed.data);
  if (!outcome.ok) return outcome;
  const checked = validateSpec(outcome.spec);
  if (!checked.ok) return reject(checked.issues.join(" "));
  const asked = parsed.data.type === "assign-fabric";
  const changes = asked ? [] : fabricChanges(spec, checked.spec, outcome.dropped);
  return accept(checked.spec, [...outcome.dropped, ...changes]);
}
