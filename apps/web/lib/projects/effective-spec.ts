import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { colourAction } from "./colour-controls";
import type { EditorState, Request, SavedChange } from "./editor-state";

/** A request made ready to send, or the reason it cannot be. */
export type Resolved =
  | Readonly<{ kind: "ready"; request: Request }>
  | Readonly<{ kind: "problem"; reason: string }>;

/**
 * Makes a request ready to send, on top of `base`: a colour change becomes a change to the
 * whole colourway, worked out from the design as it is now. Other requests are sent as they
 * are. Without a design a colour change cannot be worked out.
 */
export function resolveRequest(base: GarmentSpec | null, request: Request): Resolved {
  if (request.kind !== "colour") return { kind: "ready", request };
  if (!base) return { kind: "problem", reason: "" };
  const made = colourAction(base, request.panelId, request.change, request.colourwayId);
  return made.kind === "action" ? { kind: "ready", request: made } : made;
}

/** The changes a ready request makes, in order. Undo and restore make none that can be worked out here. */
const actionsOf = (request: Request): readonly SpecAction[] => {
  if (request.kind === "action") return [request.action];
  return request.kind === "actions" ? request.actions : [];
};

/** The design with one change applied, or as it was when the rules refuse the change. */
const applied = (current: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(current, action);
  return result.ok ? result.spec : current;
};

/**
 * The design as it will be once the given changes are saved, oldest first. A change that
 * builds on another, such as a second colour, is worked out from this, so it does not undo
 * the first. Undo and restore, and a change the rules refuse, are skipped. The design given
 * is not changed.
 */
export function effectiveSpec(spec: GarmentSpec, waiting: readonly Request[]): GarmentSpec {
  return waiting.reduce<GarmentSpec>((current, request) => {
    const resolved = resolveRequest(current, request);
    return resolved.kind === "ready" ? actionsOf(resolved.request).reduce(applied, current) : current;
  }, spec);
}

const asRequest = (entry: SavedChange): Request => ({ kind: "action", action: entry.action });

/** The design the server holds now: the page's design with the changes saved since it was sent. */
export const savedBase = (spec: GarmentSpec, saved: readonly SavedChange[]): GarmentSpec =>
  effectiveSpec(spec, saved.map(asRequest));

/**
 * The changes saved but not yet shown, the change on its way and the changes waiting, oldest
 * first. `shown` is the version of the design the page holds, so a saved change it already
 * shows is not counted twice.
 */
export function pendingRequests(state: Pick<EditorState, "saved" | "inFlight" | "queue">, shown: number): readonly Request[] {
  const saved = state.saved.filter((entry) => entry.version > shown).map(asRequest);
  const waiting = [state.inFlight?.request, ...state.queue.map((change) => change.request)];
  return [...saved, ...waiting.filter((request): request is Request => request !== undefined)];
}

/** The design as it will be once everything saved, on its way and waiting has reached the page. */
export const workingSpec = (
  spec: GarmentSpec,
  shown: number,
  state: Pick<EditorState, "saved" | "inFlight" | "queue">,
): GarmentSpec => effectiveSpec(spec, pendingRequests(state, shown));
