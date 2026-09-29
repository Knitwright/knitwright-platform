import { applyAction, cmToTenthsMm, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { wireActionSchema, WIRE_ACTION_TYPES, type WireAction } from "./reply-schema";
import { toSpecAction } from "./to-spec-action";

export const NOTHING_CHANGED = "Nothing was changed.";

/** One change as it was made: the model's words, the editor's change, and the design before it. */
export interface Step {
  readonly wire: WireAction;
  readonly action: SpecAction;
  readonly before: GarmentSpec;
}

export type BatchResult =
  | { readonly ok: true; readonly spec: GarmentSpec; readonly steps: readonly Step[]; readonly notes: readonly string[] }
  | {
      readonly ok: false;
      readonly reason: string;
      /** The change that failed, and the design it was applied to, when it could be read. */
      readonly failed?: { readonly wire: WireAction; readonly spec: GarmentSpec };
    };

const SAFE_TYPE = /^[a-z][a-z0-9-]{0,39}$/;

/** Reads each raw action. The first that cannot be read makes the whole list unreadable, with a reason. */
export function readActions(raw: readonly unknown[]): { ok: true; actions: WireAction[] } | { ok: false; reason: string } {
  const actions: WireAction[] = [];
  for (const item of raw) {
    const parsed = wireActionSchema.safeParse(item);
    if (parsed.success) {
      actions.push(parsed.data);
      continue;
    }
    const type = typeof item === "object" && item !== null ? (item as { type?: unknown }).type : undefined;
    if (typeof type === "string" && (WIRE_ACTION_TYPES as readonly string[]).includes(type)) {
      return { ok: false, reason: `The assistant's ${type} change could not be read. ${NOTHING_CHANGED}` };
    }
    const named = typeof type === "string" && SAFE_TYPE.test(type) ? ` (${type})` : "";
    return { ok: false, reason: `The assistant asked for a change the editor does not have${named}. ${NOTHING_CHANGED}` };
  }
  return { ok: true, actions };
}

/** A change of garment type goes first, so the other changes are checked against the new type. */
const typeFirst = (actions: readonly WireAction[]): WireAction[] => [
  ...actions.filter((action) => action.type === "change-type"),
  ...actions.filter((action) => action.type !== "change-type"),
];

/**
 * True when a change asks for the value the design already has. It is skipped, so that
 * repeating a person's own choice does not relabel it as suggested by the assistant.
 */
function restates(spec: GarmentSpec, wire: WireAction): boolean {
  if (wire.type === "set-option") {
    return Object.hasOwn(spec.options, wire.optionId) && spec.options[wire.optionId].choiceId === wire.choiceId;
  }
  if (wire.type === "set-measurement") {
    const value = cmToTenthsMm(wire.cm);
    return spec.measurements.some((entry) => entry.pointId === wire.pointId && entry.value === value);
  }
  return false;
}

/**
 * Applies every change through the editor's own apply path, or none of them. The first
 * change that cannot be made stops the batch and its reason is returned.
 */
export function applyBatch(spec: GarmentSpec, actions: readonly WireAction[]): BatchResult {
  let current = spec;
  const steps: Step[] = [];
  const notes: string[] = [];
  for (const wire of typeFirst(actions)) {
    if (restates(current, wire)) continue;
    const converted = toSpecAction(current, wire);
    if (!converted.ok) return { ok: false, reason: `${converted.reason} ${NOTHING_CHANGED}`, failed: { wire, spec: current } };
    const result = applyAction(current, converted.action);
    if (!result.ok) return { ok: false, reason: `${result.reason} ${NOTHING_CHANGED}`, failed: { wire, spec: current } };
    steps.push({ wire, action: converted.action, before: current });
    notes.push(...result.dropped.map((item) => item.message));
    current = result.spec;
  }
  return { ok: true, spec: current, steps, notes: [...new Set(notes)] };
}
