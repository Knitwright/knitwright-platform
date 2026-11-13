"use client";

import { useEffect, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useCanvasStore } from "@/components/canvas/CanvasStore";
import { boxOf, contentBounds, zoomPercent, type Point } from "@/lib/canvas";
import { shortcutOf, type EditorShortcut } from "@/lib/editor-chrome";
import type { BoardView, DockTool } from "@/lib/launch";

/**
 * The editor's keys and the canvas's right-click (decision 0146).
 *
 *   * **Shortcuts** (`08` §5.8) are read on the window, so they work wherever focus is, except in a
 *     field a person types into (`shortcutOf`). Delete and Esc act only when focus is on the canvas
 *     or nowhere in particular, so Backspace in the rail never deletes a board.
 *   * **Focus-driven reveal** (E1 left this): when a board takes focus -- Tab, a screen reader, a
 *     click -- it is brought onto the screen with the store's `reveal`. A board panned above or to
 *     the left of the canvas is one the browser cannot scroll to, so without this Tab could land on
 *     a board nobody can see.
 *   * **The context menu** opens on a right-click on a board, or on Shift-F10 or the Menu key while
 *     a board has focus.
 */

export type EditorActions = Readonly<{
  boards: readonly BoardView[];
  canEdit: boolean;
  onTool: (tool: DockTool) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: (board: BoardView) => void;
  onRemove: (board: BoardView) => void;
  /** The address keeps the zoom in step with the store (`?zoom=`). */
  onZoomed: (percent: number) => void;
}>;

export type OpenMenu = Readonly<{ boardId: string; at: Point }> | null;

/** Whether focus is on the canvas, or on nothing in particular. */
const onCanvas = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return true;
  return target === document.body || target.closest('[data-testid="flow-canvas"]') !== null;
};

const boardOf = (target: EventTarget | null): string | null => (target instanceof HTMLElement ? (target.closest<HTMLElement>("[data-board-id]")?.dataset["boardId"] ?? null) : null);

export function useEditorInput(actions: EditorActions) {
  const store = useCanvasStore();
  const [menu, setMenu] = useState<OpenMenu>(null);

  useEffect(() => {
    const selected = (): readonly BoardView[] => actions.boards.filter((board) => store.getState().selection.includes(board.id));
    const zoomed = () => actions.onZoomed(zoomPercent(store.getState().viewport));
    const act = (shortcut: EditorShortcut, event: globalThis.KeyboardEvent): boolean => {
      switch (shortcut.kind) {
        case "tool":
          actions.onTool(shortcut.tool);
          return false;
        case "zoom-in":
        case "zoom-out":
          store.zoomStep(shortcut.kind === "zoom-in" ? 1 : -1);
          zoomed();
          return true;
        case "fit":
          store.fit(contentBounds(actions.boards));
          zoomed();
          return true;
        case "save":
          actions.onSave();
          return true;
        case "undo":
          actions.onUndo();
          return true;
        case "redo":
          actions.onRedo();
          return true;
        case "duplicate":
          if (actions.canEdit) for (const board of selected()) actions.onDuplicate(board);
          return true;
        case "delete":
          if (!actions.canEdit || !onCanvas(event.target)) return false;
          for (const board of selected()) actions.onRemove(board);
          return selected().length > 0;
        case "escape":
          if (!onCanvas(event.target) || store.getState().selection.length === 0) return false;
          store.select(null);
          return true;
      }
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = shortcutOf(event);
      if (shortcut && act(shortcut, event)) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, store]);

  /** A board that takes focus is brought onto the screen. */
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const id = boardOf(event.target);
    const board = id === null ? undefined : actions.boards.find((one) => one.id === id);
    if (board) store.reveal(boxOf(board));
  };

  const open = (boardId: string, at: Point) => {
    if (!store.getState().selection.includes(boardId)) store.select(boardId);
    setMenu({ boardId, at });
  };

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    const id = boardOf(event.target);
    if (id === null) return;
    event.preventDefault();
    open(id, { x: event.clientX, y: event.clientY });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!(event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) return;
    const id = boardOf(event.target);
    if (id === null) return;
    event.preventDefault();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    open(id, { x: rect.left + 16, y: rect.top + 16 });
  };

  return { menu, setMenu, open, onFocus, onContextMenu, onKeyDown };
}
