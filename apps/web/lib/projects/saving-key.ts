import type { EditorState } from "./editor-state";

/**
 * True while the change a control asked for is on its way or waiting its turn. That control shows
 * it is working; the others only wait, so the person can see which one they pressed.
 */
export const isSaving = (state: EditorState, key: string): boolean =>
  state.inFlight?.key === key || state.queue.some((change) => change.key === key);
