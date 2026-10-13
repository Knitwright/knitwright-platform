import type { ActionResult } from "./apply-action";
import { conditionsHold } from "./conditions";
import type { Dropped } from "./dropped";
import { pointName } from "./labels";
import type { SizeMeasurement, Sizing, Tolerance } from "./parts";
import { getType, type ResolvedType } from "./registry";
import type { GarmentSpec } from "./spec-schema";

/**
 * Values a person typed for sizes other than the base size, and tolerances a person typed.
 * Without a size chart nothing can work these out, so a factory would get "To be confirmed"
 * with no way to fill it in. Both lists are optional on a design, so older designs read as
 * they were.
 */

const accept = (spec: GarmentSpec, dropped: readonly Dropped[] = []): ActionResult => ({ ok: true, spec, dropped });
const reject = (reason: string): ActionResult => ({ ok: false, reason });

const nameOf = (spec: GarmentSpec, pointId: string): string => {
  const type = getType(spec.typeId);
  return type ? pointName(type, pointId) : pointId;
};

/** Every design reads these as lists, whether or not it was saved with them. */
export const sizeValuesOf = (spec: Pick<GarmentSpec, "sizeMeasurements">): readonly SizeMeasurement[] => spec.sizeMeasurements ?? [];
export const tolerancesOf = (spec: Pick<GarmentSpec, "tolerances">): readonly Tolerance[] => spec.tolerances ?? [];

/** The value typed for this point at this size, if any. */
export const sizeValueFor = (spec: Pick<GarmentSpec, "sizeMeasurements">, pointId: string, size: string): SizeMeasurement | undefined =>
  sizeValuesOf(spec).find((entry) => entry.pointId === pointId && entry.size === size);

export const toleranceFor = (spec: Pick<GarmentSpec, "tolerances">, pointId: string): Tolerance | undefined =>
  tolerancesOf(spec).find((entry) => entry.pointId === pointId);

/** A list left empty is taken off the design, so a design that never used it stays as it was saved. */
const withList = <K extends "sizeMeasurements" | "tolerances">(
  spec: GarmentSpec,
  key: K,
  list: NonNullable<GarmentSpec[K]>,
): GarmentSpec => {
  const rest = Object.fromEntries(Object.entries(spec).filter(([name]) => name !== key)) as GarmentSpec;
  return list.length === 0 ? rest : { ...rest, [key]: list };
};

/**
 * Sets the value of one point at one size. The base size keeps its value in the measurement
 * itself, so a value for it here is refused with a plain reason.
 */
export function setSizeMeasurement(spec: GarmentSpec, entry: SizeMeasurement): ActionResult {
  if (spec.sizing?.baseSize === entry.size) {
    return reject(`Size ${entry.size} is the base size. Set ${nameOf(spec, entry.pointId)} for it in the measurement itself.`);
  }
  const others = sizeValuesOf(spec).filter((old) => !(old.pointId === entry.pointId && old.size === entry.size));
  return accept(withList(spec, "sizeMeasurements", [...others, entry]));
}

export function removeSizeMeasurement(spec: GarmentSpec, pointId: string, size: string): ActionResult {
  if (!sizeValueFor(spec, pointId, size)) return reject(`There is no value of yours for ${nameOf(spec, pointId)} at size ${size}.`);
  const kept = sizeValuesOf(spec).filter((old) => !(old.pointId === pointId && old.size === size));
  return accept(withList(spec, "sizeMeasurements", kept));
}

export function setTolerance(spec: GarmentSpec, entry: Tolerance): ActionResult {
  const others = tolerancesOf(spec).filter((old) => old.pointId !== entry.pointId);
  return accept(withList(spec, "tolerances", [...others, entry]));
}

export function removeTolerance(spec: GarmentSpec, pointId: string): ActionResult {
  if (!toleranceFor(spec, pointId)) return reject(`There is no tolerance of yours for ${nameOf(spec, pointId)}.`);
  return accept(withList(spec, "tolerances", tolerancesOf(spec).filter((old) => old.pointId !== pointId)));
}

/**
 * Sets the size run, and removes the values typed for sizes the design no longer has, or for
 * the size that is now the base size. Each one removed is reported.
 */
export function setSizing(spec: GarmentSpec, sizing: Sizing | null): ActionResult {
  const next = { ...spec, sizing };
  if (sizing === null) return accept(next);
  const dropped: Dropped[] = [];
  const kept = sizeValuesOf(spec).filter((entry) => {
    if (sizing.sizes.includes(entry.size) && entry.size !== sizing.baseSize) return true;
    const why = entry.size === sizing.baseSize ? "it is now the base size" : "the design no longer has that size";
    dropped.push({
      kind: "measurement",
      id: entry.pointId,
      message: `Your value for ${nameOf(spec, entry.pointId)} at size ${entry.size} was removed, because ${why}.`,
    });
    return false;
  });
  return accept(withList(next, "sizeMeasurements", kept), dropped);
}

/** Keeps the typed values and tolerances of the points that still apply. Each one removed is reported. */
export function keepApplyingSizeValues(spec: GarmentSpec, type: ResolvedType, dropped: Dropped[]): GarmentSpec {
  const applies = (pointId: string): string | null => {
    const point = type.pointsOfMeasure.find((entry) => entry.id === pointId);
    if (point && conditionsHold(point.appliesWhen, spec.options)) return null;
    return point?.unavailableReason ?? `${type.label} does not have it.`;
  };
  const sizeValues = sizeValuesOf(spec).filter((entry) => {
    const reason = applies(entry.pointId);
    if (reason === null) return true;
    dropped.push({
      kind: "measurement",
      id: entry.pointId,
      message: `Your value for ${pointName(type, entry.pointId)} at size ${entry.size} was removed. ${reason}`,
    });
    return false;
  });
  const tolerances = tolerancesOf(spec).filter((entry) => {
    const reason = applies(entry.pointId);
    if (reason === null) return true;
    dropped.push({
      kind: "measurement",
      id: entry.pointId,
      message: `Your tolerance for ${pointName(type, entry.pointId)} was removed. ${reason}`,
    });
    return false;
  });
  return withList(withList(spec, "sizeMeasurements", sizeValues), "tolerances", tolerances);
}
