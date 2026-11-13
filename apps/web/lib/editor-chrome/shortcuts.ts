import type { DockTool } from "@/lib/launch";
import { isTyping } from "@/lib/canvas";

/**
 * THE EDITOR'S KEYBOARD SHORTCUTS (`08` §5.8, "copy Kittl"; decision 0146).
 *
 * One table, read twice: by the editor's key handler, and by the Help flyout that lists them, so
 * the list a person reads is the list that works. A key typed into a field is never a shortcut.
 *
 * Three of §5.8's rows are already the canvas's own (decision 0145) and are not repeated here:
 * Space-drag pans, and + / − / 0 / 1 without a modifier zoom while the canvas has focus. Two rows
 * have nothing behind them yet and are left out rather than bound to nothing: Alt-drag duplicate and
 * ⌘G / ⇧G group and ungroup (boards do not group; layers inside a board are E3's). Decision 0146
 * lists them.
 */

export type EditorShortcut =
  | Readonly<{ kind: "tool"; tool: DockTool }>
  | Readonly<{ kind: "zoom-in" | "zoom-out" | "fit" | "save" | "undo" | "redo" | "duplicate" | "delete" | "escape" }>;

export interface ShortcutKey {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly target?: unknown;
}

const TOOL_KEYS: Readonly<Record<string, DockTool>> = { v: "select", f: "frame", r: "shape", o: "shape", p: "pen", t: "text", c: "comment" };

const WITH_COMMAND: Readonly<Record<string, EditorShortcut["kind"]>> = {
  "=": "zoom-in",
  "+": "zoom-in",
  "-": "zoom-out",
  _: "zoom-out",
  "0": "fit",
  s: "save",
  d: "duplicate",
  y: "redo",
};

/** The shortcut a key press asks for, or null. */
export function shortcutOf(event: ShortcutKey): EditorShortcut | null {
  if (event.altKey === true || isTyping(event.target)) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const command = event.ctrlKey === true || event.metaKey === true;
  if (command) {
    if (key === "z") return { kind: event.shiftKey === true ? "redo" : "undo" };
    const kind = WITH_COMMAND[key];
    return kind ? ({ kind } as EditorShortcut) : null;
  }
  if (key === "Escape") return { kind: "escape" };
  if (key === "Delete" || key === "Backspace") return { kind: "delete" };
  if (event.shiftKey === true) return null;
  const tool = TOOL_KEYS[key];
  return tool ? { kind: "tool", tool } : null;
}

/** The rows the Help flyout shows, in §5.8's order. `keys` are the words on the keycaps. */
export const SHORTCUT_ROWS: readonly Readonly<{ keys: readonly string[]; does: string }>[] = [
  { keys: ["V"], does: "Select" },
  { keys: ["F"], does: "Frame" },
  { keys: ["R", "O"], does: "Shape" },
  { keys: ["P"], does: "Pen" },
  { keys: ["T"], does: "Text" },
  { keys: ["C"], does: "Comment" },
  { keys: ["Space"], does: "Hold and drag to pan" },
  { keys: ["Ctrl", "+"], does: "Zoom in" },
  { keys: ["Ctrl", "−"], does: "Zoom out" },
  { keys: ["Ctrl", "0"], does: "Fit to content" },
  { keys: ["Ctrl", "S"], does: "Save a version" },
  { keys: ["Ctrl", "Z"], does: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], does: "Redo" },
  { keys: ["Ctrl", "D"], does: "Duplicate the selected board" },
  { keys: ["Delete"], does: "Delete the selected board" },
  { keys: ["Tab"], does: "Next board, brought onto the screen" },
  { keys: ["Shift", "F10"], does: "The selected board's menu" },
];
