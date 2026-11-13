import type { BoardView } from "@/lib/launch";

/**
 * THE ZOOM MENU AND THE BOARD'S CONTEXT MENU (`08` §5.1; prototype e35 and e36; decision 0146).
 *
 * Plain rows, so the screens draw them and the tests read them. Every row is something the editor
 * does now, through the canvas store (zoom, fit, reveal) or the launch shell's commands (duplicate,
 * delete, add a board); a row that cannot be used here says why instead of disappearing. Kittl's
 * Copy, Paste, "Copy/Paste as", "Add to Brand" and "Convert to Image" have nothing behind them on
 * a board yet, so they are not offered (decision 0146 lists them).
 */

export type ZoomChoice = Readonly<{ kind: "fit-content" } | { kind: "fit-selection" } | { kind: "scale"; scale: number }>;

export interface ZoomRow {
  readonly id: string;
  readonly label: string;
  readonly choice: ZoomChoice;
  readonly disabled: boolean;
}

/** The menu under the zoom per-cent: fits first, then three fixed scales, as in e36. */
export function zoomRows(hasSelection: boolean): readonly ZoomRow[] {
  return [
    { id: "fit-content", label: "Fit to content", choice: { kind: "fit-content" }, disabled: false },
    { id: "fit-selection", label: "Fit to selection", choice: { kind: "fit-selection" }, disabled: !hasSelection },
    ...[0.5, 1, 2].map((scale) => ({ id: `scale-${scale * 100}`, label: `${scale * 100}%`, choice: { kind: "scale", scale } as ZoomChoice, disabled: false })),
  ];
}

export type ContextCommand = "duplicate" | "remove" | "fit-selection" | "download" | "open-editor" | "add-artboard";

export type ContextRow =
  | Readonly<{ id: ContextCommand; label: string; shortcut?: string; danger?: boolean; disabledReason: string | null }>
  | Readonly<{ id: string; separator: true }>;

const designOf = (board: BoardView): string | null => {
  const value = board.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const NOTHING_TO_EXPORT = "Run this board first: there is nothing to export yet.";

/** The ⋯ menu of one board, also opened by a right-click, Shift-F10 or the Menu key. */
export function contextRows(board: BoardView, canEdit: boolean): readonly ContextRow[] {
  const locked = canEdit ? null : "Only owners, admins and kit managers can change this project.";
  const garment = (board.kind === "garment" || board.kind === "design") && designOf(board) !== null;
  return [
    { id: "duplicate", label: "Duplicate", shortcut: "Ctrl + D", disabledReason: locked },
    { id: "remove", label: "Delete", shortcut: "Del", danger: true, disabledReason: locked },
    { id: "rule-1", separator: true },
    { id: "fit-selection", label: "Zoom to this board", disabledReason: null },
    { id: "download", label: "Quick export", disabledReason: board.outputFileId === null ? NOTHING_TO_EXPORT : null },
    ...(garment ? [{ id: "open-editor" as const, label: "Open in editor", disabledReason: null }] : []),
    { id: "rule-2", separator: true },
    { id: "add-artboard", label: "Add artboard", disabledReason: locked },
  ];
}
