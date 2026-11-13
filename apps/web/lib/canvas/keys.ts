/**
 * The canvas's own keys (`08` §5.8): + / − / 0 / 1 zoom in, out, to fit and to 100%, with or
 * without Ctrl/⌘ (Kittl takes both). Space held pans. A key typed into a field is never the
 * canvas's: the person is writing.
 */

export type CanvasKeyAction = "zoom-in" | "zoom-out" | "fit" | "actual";

export interface KeyLike {
  readonly key: string;
  readonly altKey?: boolean;
  /** The element the key was pressed in. */
  readonly target?: unknown;
}

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Whether a key went to something a person types into. */
export function isTyping(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  return (typeof element.tagName === "string" && TYPING.has(element.tagName)) || element.isContentEditable === true;
}

const ACTIONS: Readonly<Record<string, CanvasKeyAction>> = {
  "+": "zoom-in",
  "=": "zoom-in",
  "-": "zoom-out",
  "_": "zoom-out",
  "0": "fit",
  "1": "actual",
};

/** The zoom a key asks for, or null. */
export function canvasKey(event: KeyLike): CanvasKeyAction | null {
  if (event.altKey === true || isTyping(event.target)) return null;
  return ACTIONS[event.key] ?? null;
}

/** Whether a key is the Space that pans while it is held. */
export const isPanKey = (event: KeyLike): boolean => event.key === " " && !isTyping(event.target);
