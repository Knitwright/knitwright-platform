import {
  MEASUREMENT_MAX_TENTHS_MM,
  formatCm,
  pointsOfMeasureFor,
  type GarmentSpec,
  type SpecAction,
} from "@/lib/garment";

/** Who is typing. A value they type becomes theirs, and no longer a suggestion. */
export type Editor = "brand-supplied" | "user-edited";

export type EditResult =
  | { readonly ok: true; readonly action: SpecAction }
  | { readonly ok: false; readonly reason: string };

const refuse = (reason: string): EditResult => ({ ok: false, reason });

/**
 * The action the editor applies when a person types a measurement. Whoever types it owns
 * it, so the provenance is theirs. Nothing is changed here. The action is returned.
 */
export function editMeasurementAction(
  spec: GarmentSpec,
  pointId: string,
  value: number,
  editor: Editor,
): EditResult {
  if (!pointsOfMeasureFor(spec).some((point) => point.id === pointId)) {
    return refuse(`${pointId} does not apply to this design, so it cannot be set.`);
  }
  if (!Number.isInteger(value) || value < 1 || value > MEASUREMENT_MAX_TENTHS_MM) {
    return refuse(
      `Enter a length above zero and up to ${formatCm(MEASUREMENT_MAX_TENTHS_MM)} cm, in whole tenths of a millimetre.`,
    );
  }
  return { ok: true, action: { type: "set-measurement", pointId, value, provenance: editor } };
}

/** The action that puts a value back to the chart. It removes the value a person set. */
export function resetMeasurementAction(spec: GarmentSpec, pointId: string): EditResult {
  if (!spec.measurements.some((entry) => entry.pointId === pointId)) {
    return refuse(`${pointId} has no value of your own. It is already from the chart.`);
  }
  return { ok: true, action: { type: "remove-measurement", pointId } };
}
