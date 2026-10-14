import type { ViewLandmarks } from "./types";

/**
 * The side-by-side screen's state, as plain data and a reducer so the rules are tested without a browser. Nothing here
 * calls the server. No zod and no value imports, so it is cheap to ship to the browser.
 */

export type Stage = "idle" | "uploading" | "reading" | "review" | "working" | "done" | "failed";

export interface ScreenState {
  readonly stage: Stage;
  readonly message: string | null;
  /** Layer ids ticked for acceptance. */
  readonly ticked: ReadonlySet<string>;
  /** Landmarks the person dragged since the last fit, as fractions of the picture. */
  readonly moved: ViewLandmarks;
  readonly importId: string | null;
  readonly previewUrl: string | null;
}

export const initialScreen: ScreenState = { stage: "idle", message: null, ticked: new Set(), moved: {}, importId: null, previewUrl: null };

export type ScreenAction =
  | { readonly type: "chosen"; readonly previewUrl: string }
  | { readonly type: "uploaded" }
  | { readonly type: "ready"; readonly importId: string; readonly layerIds: readonly string[] }
  | { readonly type: "tick"; readonly id: string; readonly on: boolean }
  | { readonly type: "tick-all"; readonly layerIds: readonly string[]; readonly on: boolean }
  | { readonly type: "move"; readonly view: "front" | "back"; readonly id: string; readonly x: number; readonly y: number }
  | { readonly type: "working" }
  | { readonly type: "refitted"; readonly layerIds: readonly string[] }
  | { readonly type: "done"; readonly message: string }
  | { readonly type: "failed"; readonly message: string }
  | { readonly type: "discard" };

const ALT = "-alt";
/** A repeating picture kept as the alternative to a pattern from our list. It starts unticked: choose it instead of the pattern. */
const isAlternative = (id: string): boolean => id.endsWith(ALT);
const starting = (ids: readonly string[]): Set<string> => new Set(ids.filter((id) => !isAlternative(id)));

const clamp = (n: number): number => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));

export function screenReducer(state: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case "chosen":
      return { ...initialScreen, stage: "uploading", previewUrl: action.previewUrl };
    case "uploaded":
      return { ...state, stage: "reading", message: null };
    case "ready":
      return { ...state, stage: "review", importId: action.importId, ticked: starting(action.layerIds), moved: {}, message: null };
    case "tick": {
      const ticked = new Set(state.ticked);
      if (action.on) {
        ticked.add(action.id);
        // The pattern and its alternative are one or the other.
        ticked.delete(isAlternative(action.id) ? action.id.slice(0, -ALT.length) : `${action.id}${ALT}`);
      } else ticked.delete(action.id);
      return { ...state, ticked };
    }
    case "tick-all":
      return { ...state, ticked: action.on ? starting(action.layerIds) : new Set() };
    case "move": {
      const view = state.moved[action.view] ?? {};
      return { ...state, moved: { ...state.moved, [action.view]: { ...view, [action.id]: { x: clamp(action.x), y: clamp(action.y) } } } };
    }
    case "working":
      return { ...state, stage: "working", message: null };
    case "refitted":
      return { ...state, stage: "review", moved: {}, ticked: starting(action.layerIds) };
    case "done":
      return { ...state, stage: "done", message: action.message };
    case "failed":
      return { ...state, stage: "failed", message: action.message };
    case "discard":
      return { ...initialScreen };
  }
}

/** True when something can be accepted: a reading is on screen and at least one layer is ticked. */
export const canAccept = (state: ScreenState): boolean => state.stage === "review" && state.ticked.size > 0 && state.importId !== null;

export const hasMoves = (state: ScreenState): boolean => Object.values(state.moved).some((view) => Object.keys(view ?? {}).length > 0);

/** What the server is sent to accept: every layer (the alternatives aside) when all are ticked, else the ones ticked. */
export const acceptBody = (state: ScreenState, allIds: readonly string[]): { layerIds: "all" | string[] } =>
  allIds.every((id) => state.ticked.has(id) === !isAlternative(id)) ? { layerIds: "all" } : { layerIds: allIds.filter((id) => state.ticked.has(id)) };
