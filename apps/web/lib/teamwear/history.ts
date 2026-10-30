/**
 * The undo and redo buttons on the tool rail (spec F-T1). The configurator holds nothing until the
 * person presses Save, so its history is a list of whole kit values rather than a list of changes:
 * undo is "the one before", and there is nothing to replay.
 *
 * The stack is capped, so a long session cannot grow without bound. The oldest value falls off the
 * back, and the buttons say so by going quiet, never by failing.
 */

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** How many steps back a person may go. Enough for a whole configuring session; not unbounded. */
export const HISTORY_LIMIT = 50;

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** The history with a new value on it. The redo side is dropped, as every editor drops it. */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  const past = [...history.past, history.present];
  return { past: past.slice(Math.max(0, past.length - HISTORY_LIMIT)), present: next, future: [] };
}

export const canUndo = <T>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: History<T>): boolean => history.future.length > 0;

/** One step back, or the same history when there is nothing behind it. */
export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

/** One step forward, or the same history when there is nothing in front of it. */
export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}
