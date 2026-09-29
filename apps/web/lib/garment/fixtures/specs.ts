import type { ActionResult } from "../apply-action";
import { createSpec, type GarmentSpec } from "../spec";
import { deepFreeze } from "./freeze";

/** A frozen starting spec. Test support only. */
export function start(typeId: string, wearer: "men" | "women" | "youth" = "women"): GarmentSpec {
  const result = createSpec(typeId, wearer);
  if (!result.ok) throw new Error(result.reason);
  return deepFreeze(result.spec);
}

export function accepted(result: ActionResult): { spec: GarmentSpec; dropped: ActionResultDropped } {
  if (!result.ok) throw new Error(`Rejected: ${result.reason}`);
  return result;
}

type ActionResultDropped = Extract<ActionResult, { ok: true }>["dropped"];

export function rejected(result: ActionResult): string {
  if (result.ok) throw new Error("Expected a rejection.");
  return result.reason;
}

export const setOption = (optionId: string, choiceId: string, provenance = "user-edited") => ({
  type: "set-option",
  optionId,
  choiceId,
  provenance,
});

export const fabric = (id: string, patch: object = {}) => ({
  id,
  name: `Fabric ${id}`,
  composition: "100% polyester",
  construction: "",
  weightGsm: 120,
  finish: "",
  stretch: "two-way",
  provenance: "brand-supplied",
  ...patch,
});
