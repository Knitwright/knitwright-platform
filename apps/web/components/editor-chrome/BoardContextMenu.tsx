"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";
import type { Point } from "@/lib/canvas";
import { contextRows, type ContextCommand } from "@/lib/editor-chrome";
import type { BoardView } from "@/lib/launch";
import { FloatingMenu, MENU_ROW, MenuRule } from "./FloatingMenu";

type Props = Readonly<{
  board: BoardView;
  at: Point;
  canEdit: boolean;
  onCommand: (command: ContextCommand) => void;
  onClose: () => void;
}>;

/** How far in from the window's edge the menu is held, so all of it is on the screen. */
const EDGE = 8;
const WIDTH = 280;
const HEIGHT = 320;

/**
 * A board's context menu (`08` §5.1; prototype e35; decision 0146): opened by a right-click on the
 * board, by Shift-F10 or the Menu key on a focused board, or by the task bar's ⋯. Its rows are
 * `lib/editor-chrome/menus.ts`'s. Focus goes back to the board when it closes.
 */
export function BoardContextMenu({ board, at, canEdit, onCommand, onClose }: Props) {
  // The board itself is the menu's trigger: Esc and a chosen row put focus back on it.
  const [anchor] = useState<{ current: HTMLElement | null }>(() => ({ current: document.querySelector<HTMLElement>(`[data-board-id="${board.id}"]`) }));
  const place = {
    x: Math.max(EDGE, Math.min(at.x, window.innerWidth - WIDTH - EDGE)),
    y: Math.max(EDGE, Math.min(at.y, window.innerHeight - HEIGHT - EDGE)),
  };
  return (
    <FloatingMenu id={`board-menu-${board.id}`} label={`${board.name || "Board"} menu`} open onClose={onClose} trigger={anchor} place={place} className="w-70">
      {contextRows(board, canEdit).map((row) =>
        "separator" in row ? (
          <MenuRule key={row.id} />
        ) : (
          <button
            key={row.id}
            type="button"
            role="menuitem"
            disabled={row.disabledReason !== null}
            title={row.disabledReason ?? undefined}
            onClick={() => {
              onClose();
              anchor.current?.focus();
              onCommand(row.id);
            }}
            className={cx(MENU_ROW, row.danger && "text-bad hover:bg-bad-soft")}
            data-testid={`board-menu-${row.id}`}
          >
            {row.label}
            {row.shortcut ? <kbd className="ml-auto font-sans text-small text-muted">{row.shortcut}</kbd> : null}
          </button>
        ),
      )}
    </FloatingMenu>
  );
}
