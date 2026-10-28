import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { editMeasurementAction, resetMeasurementAction } from "@/lib/sizing";
import type { EditIntent } from "./field-text";

type MeasurementRequest =
  | Readonly<{ kind: "action"; action: SpecAction }>
  | Readonly<{ kind: "problem"; reason: string }>;

/**
 * Turns what a person asked for in a measurement field into a change for the server, or
 * into a plain reason why not. Nothing to do gives null.
 */
export const requestForIntent = (spec: GarmentSpec, pointId: string, intent: EditIntent): MeasurementRequest | null => {
  switch (intent.kind) {
    case "none":
      return null;
    case "invalid":
      return { kind: "problem", reason: intent.reason };
    case "set":
      return fromEdit(editMeasurementAction(spec, pointId, intent.tenths, "user-edited"));
    case "remove":
      return fromEdit(resetMeasurementAction(spec, pointId));
  }
};

const fromEdit = (result: ReturnType<typeof editMeasurementAction>): MeasurementRequest =>
  result.ok ? { kind: "action", action: result.action } : { kind: "problem", reason: result.reason };
