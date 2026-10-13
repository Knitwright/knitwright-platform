import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import type { EditorState } from "./editor-state";

/**
 * The changes that are on their way to the server or waiting to be sent, oldest first.
 * Undo and restore are not included: they wait for everything else to finish.
 */
export function pendingActions(state: Pick<EditorState, "inFlight" | "queue">): readonly SpecAction[] {
  const requests = [state.inFlight?.request, ...state.queue.map((change) => change.request)];
  return requests.flatMap((request) => {
    if (request?.kind === "action") return [request.action];
    return request?.kind === "actions" ? request.actions : [];
  });
}

/**
 * The design as it will be once the waiting changes are saved. A change that builds on
 * another, such as a second colour, is worked out from this, so it does not undo the first.
 * A change the rules refuse is skipped. The design given is not changed.
 */
export function effectiveSpec(spec: GarmentSpec, waiting: readonly SpecAction[]): GarmentSpec {
  return waiting.reduce((current, action) => {
    const result = applyAction(current, action);
    return result.ok ? result.spec : current;
  }, spec);
}
