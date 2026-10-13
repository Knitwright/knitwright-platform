import { applyAction, cmToTenthsMm, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { wireActionSchema, WIRE_ACTION_TYPES, type WireAction } from "./reply-schema";
import { AI_SOURCE, toSpecAction, type ModelSource } from "./to-spec-action";

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

type OneResult =
  | { readonly ok: true; readonly spec: GarmentSpec; readonly step: Step | null; readonly notes: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/** One change through the editor's own apply path. A change that restates the design makes no step. */
function applyOne(spec: GarmentSpec, wire: WireAction, source: ModelSource): OneResult {
  if (restates(spec, wire)) return { ok: true, spec, step: null, notes: [] };
  const converted = toSpecAction(spec, wire, source);
  if (!converted.ok) return converted;
  const result = applyAction(spec, converted.action);
  if (!result.ok) return result;
  return { ok: true, spec: result.spec, step: { wire, action: converted.action, before: spec }, notes: result.dropped.map((item) => item.message) };
}

/**
 * Applies every change through the editor's own apply path, or none of them. The first
 * change that cannot be made stops the batch and its reason is returned.
 */
export function applyBatch(spec: GarmentSpec, actions: readonly WireAction[], source: ModelSource = AI_SOURCE): BatchResult {
  let current = spec;
  const steps: Step[] = [];
  const notes: string[] = [];
  for (const wire of typeFirst(actions)) {
    const one = applyOne(current, wire, source);
    if (!one.ok) return { ok: false, reason: `${one.reason} ${NOTHING_CHANGED}`, failed: { wire, spec: current } };
    if (one.step) steps.push(one.step);
    notes.push(...one.notes);
    current = one.spec;
  }
  return { ok: true, spec: current, steps, notes: [...new Set(notes)] };
}

/** What a request made of its parts: the design after every part that could be made, and the rest. */
export interface EachResult {
  readonly spec: GarmentSpec;
  readonly steps: readonly Step[];
  readonly notes: readonly string[];
  /** The parts that could not be made, each with the editor's reason. */
  readonly skipped: readonly { readonly wire: WireAction; readonly reason: string }[];
}

/**
 * Applies each change that can be made, in order, and keeps the others aside with their
 * reasons. One part that cannot be made no longer stops the parts that can (the assistant
 * audit, item 1): the person is told about each one instead.
 */
export function applyEach(spec: GarmentSpec, actions: readonly WireAction[], source: ModelSource = AI_SOURCE): EachResult {
  let current = spec;
  const steps: Step[] = [];
  const notes: string[] = [];
  const skipped: { wire: WireAction; reason: string }[] = [];
  for (const wire of typeFirst(actions)) {
    const one = applyOne(current, wire, source);
    if (!one.ok) {
      skipped.push({ wire, reason: one.reason });
      continue;
    }
    if (one.step) steps.push(one.step);
    notes.push(...one.notes);
    current = one.spec;
  }
  return { spec: current, steps, notes: [...new Set(notes)], skipped };
}
