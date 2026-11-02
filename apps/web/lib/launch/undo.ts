/**
 * Undo and redo for the launch canvas (spec Launch shell, "Bottom centre": undo/redo).
 *
 * A plain three-part stack: what came before, what is on screen, and what an undo moved away from.
 * It holds whole states rather than changes, because a board move, a resize, a connector and a
 * setting are not the same shape, and a stack of changes would need to know how to reverse each
 * one. A whole state is one thing to reverse and nothing to get wrong.
 *
 * The depth is capped so a long session cannot grow without bound; the oldest state falls off the
 * back, as every editor's undo does.
 */

export interface UndoStack<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** How many states back an undo can reach. */
export const UNDO_DEPTH = 50;

export const started = <T>(present: T): UndoStack<T> => ({ past: [], present, future: [] });

/**
 * A new state on the stack. The redo chain is dropped, because redoing after a change would put
 * back something the person has since worked past.
 */
export function pushed<T>(stack: UndoStack<T>, next: T): UndoStack<T> {
  const past = [...stack.past, stack.present].slice(-UNDO_DEPTH);
  return { past, present: next, future: [] };
}

export const canUndo = <T>(stack: UndoStack<T>): boolean => stack.past.length > 0;
export const canRedo = <T>(stack: UndoStack<T>): boolean => stack.future.length > 0;

/** One step back. A stack with nothing behind it is returned unchanged, so the button is simply off. */
export function undone<T>(stack: UndoStack<T>): UndoStack<T> {
  const previous = stack.past[stack.past.length - 1];
  if (previous === undefined) return stack;
  return { past: stack.past.slice(0, -1), present: previous, future: [stack.present, ...stack.future] };
}

/** One step forward, after an undo. */
export function redone<T>(stack: UndoStack<T>): UndoStack<T> {
  const [next, ...rest] = stack.future;
  if (next === undefined) return stack;
  return { past: [...stack.past, stack.present], present: next, future: rest };
}
