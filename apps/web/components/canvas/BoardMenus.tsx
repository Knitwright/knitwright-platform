"use client";

import type { CSSProperties } from "react";
import { AddList, ConnectList } from "@/components/flows/BoardLists";
import { boxOf, visibleBoards, worldToScreen, type Size, type Viewport } from "@/lib/canvas";
import { addMenuFor, connectTargets, type AddItem, type ConnectTarget } from "@/lib/flows";
import { BOARDS, type BoardView, type Graph } from "@/lib/launch";
import { useCanvas } from "./CanvasStore";

/**
 * The Add… and Connect lists of the boards on screen, drawn over the plane in screen space
 * (decision 0145): a list under a board near the canvas's bottom edge is moved up to fit, and never
 * scaled down with a zoomed-out plane, so it stays readable and every item can be pressed.
 */

const GAP = 8;
const ADD_WIDTH = 240;
const CONNECT_WIDTH = 288;
const LIST_HEIGHT = 288;

/** Where a list opens: under the board's right edge, held inside the canvas. */
export function listPlace(board: BoardView, view: Viewport, screen: Size, width: number): CSSProperties {
  const box = boxOf(board);
  const corner = worldToScreen(view, { x: box.x + box.width, y: box.y + box.height });
  const left = Math.max(GAP, Math.min(corner.x - width, screen.width - width - GAP));
  const top = Math.max(GAP, Math.min(corner.y + 4, screen.height - Math.min(LIST_HEIGHT, screen.height - GAP * 2) - GAP));
  return { left, top, maxHeight: Math.max(120, screen.height - top - GAP) };
}

export type BoardMenusProps = Readonly<{
  graph: Graph;
  menu: string | null;
  connecting: string | null;
  onAdd: (board: BoardView, item: AddItem) => void;
  onConnect: (board: BoardView, target: ConnectTarget) => void;
}>;

export function BoardMenus({ graph, menu, connecting, onAdd, onConnect }: BoardMenusProps) {
  const viewport = useCanvas((state) => state.viewport);
  const screen = useCanvas((state) => state.screen);
  const selection = useCanvas((state) => state.selection);
  const shown = screen.width > 0 ? visibleBoards(graph.boards, viewport, screen, selection) : graph.boards;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="canvas-menus">
      {shown.map((board) => {
        const name = board.name || BOARDS[board.kind].label;
        return (
          <div key={board.id} className="contents">
            <AddList
              boardId={board.id}
              name={name}
              open={menu === board.id}
              items={addMenuFor(board)}
              onAdd={(item) => onAdd(board, item)}
              className="pointer-events-auto absolute overflow-y-auto"
              style={menu === board.id ? listPlace(board, viewport, screen, ADD_WIDTH) : undefined}
            />
            <ConnectList
              boardId={board.id}
              name={name}
              open={connecting === board.id}
              targets={connectTargets(graph, board.id)}
              onConnect={(target) => onConnect(board, target)}
              className="pointer-events-auto absolute"
              style={connecting === board.id ? listPlace(board, viewport, screen, CONNECT_WIDTH) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
