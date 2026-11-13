"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { FlowBoardCard } from "@/components/flows/FlowBoardCard";
import { boxOf, primaryOf, type GarmentPreview, type Point } from "@/lib/canvas";
import { addMenuFor, connectTargets, isArrowKey, nudge, placeOf, type AddItem, type ConnectTarget } from "@/lib/flows";
import { BOARDS, type BoardView, type Graph, type LaunchCommands } from "@/lib/launch";
import { BoardDoors } from "./BoardDoors";
import { BoardMenus } from "./BoardMenus";
import { CanvasBoard } from "./CanvasBoard";
import { useCanvasStore } from "./CanvasStore";
import { GarmentPreviewPanel } from "./GarmentPreviewPanel";
import { InfiniteCanvas } from "./InfiniteCanvas";

/**
 * The launch shell's boards on the infinite plane (decision 0145). It replaces L6's scrolling flow
 * canvas and keeps every one of its doors: each board is still L6's card -- Select, Regenerate, Run
 * all downstream, Add…, Connect from here, the move buttons -- now placed in the world, with a
 * Garment board's flat above its card and a door into the editor, the tech pack or the order.
 *
 * The store's primary selection and the launch shell's selected board (`?board=`) follow each
 * other, so the inspector, the task bar and every panel keep reading the board a person chose.
 */

export type ProjectCanvasProps = Readonly<{
  graph: Graph;
  canvasId: string;
  selectedId: string | null;
  /** The zoom the address opened at, in per cent. */
  zoom: number;
  busy: boolean;
  commands: LaunchCommands;
  garments: Readonly<Record<string, GarmentPreview | null>>;
  running?: Readonly<Record<string, string>>;
}>;

const designOf = (board: BoardView): string | null => {
  const value = board.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export function ProjectCanvas({ graph, canvasId, selectedId, zoom, busy, commands, garments, running = {} }: ProjectCanvasProps) {
  const store = useCanvasStore();
  const [menu, setMenu] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  // The shell → the store: a board selected from the inspector, the task bar or the address.
  useEffect(() => {
    if (primaryOf(store.getState()) !== selectedId) store.select(selectedId);
  }, [selectedId, store]);

  // The store → the shell: a click, a marquee or Tab on the canvas.
  useEffect(
    () =>
      store.subscribe(() => {
        const primary = primaryOf(store.getState());
        if (primary !== selectedId) commands.selectBoard(primary);
      }),
    [store, selectedId, commands],
  );

  const nameOf = (board: BoardView): string => board.name || BOARDS[board.kind].label;

  const move = (board: BoardView, at: Point, how: string): void => {
    commands.moveBoard(board.id, at);
    setSaid(`${nameOf(board)} moved ${how} to ${at.x}, ${at.y}.`);
  };

  /** A drag moves every selected board with the one under the pointer. */
  const dragged = (board: BoardView, by: Point): void => {
    const selection = store.getState().selection;
    const moving = selection.includes(board.id) ? graph.boards.filter((one) => selection.includes(one.id)) : [board];
    for (const one of moving) move(one, placeOf({ x: one.at.x + by.x, y: one.at.y + by.y }), "by hand");
  };

  const onKey = (board: BoardView) => (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      if (event.key === "Escape") {
        setMenu(null);
        setConnecting(null);
      }
      return;
    }
    // Selecting is never held up by a save in flight; moving waits for it, as a drag does.
    if (isArrowKey(event.key) && !busy) {
      event.preventDefault();
      move(board, nudge(board, event.key, event.shiftKey), event.shiftKey ? "ten steps" : "one step");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      store.select(board.id);
      event.currentTarget.querySelector<HTMLElement>("button, a")?.focus();
    }
  };

  const onConnect = (fromBoardId: string, target: ConnectTarget): void => {
    if (target.inputIndex === null || target.blocked !== null) return;
    commands.connect(fromBoardId, target.boardId, target.inputIndex);
    setConnecting(null);
    setSaid(`Connected into input ${target.inputIndex} of ${target.name}.`);
  };

  const onAdd = (board: BoardView, item: AddItem): void => {
    commands.addBoard(item.kind, { x: board.at.x + boxOf(board).width + 112, y: board.at.y }, board.id);
    setMenu(null);
    setSaid(`${item.label} board added after ${nameOf(board)}.`);
  };

  const card = (board: BoardView) => (
    <FlowBoardCard
      board={board}
      graph={graph}
      selected={board.id === selectedId}
      busy={busy}
      progress={running[board.id] ?? null}
      menuOpen={menu === board.id}
      connectingOpen={connecting === board.id}
      onSelect={() => store.select(board.id === selectedId ? null : board.id)}
      onMenu={() => setMenu(menu === board.id ? null : board.id)}
      onConnecting={() => setConnecting(connecting === board.id ? null : board.id)}
      addItems={addMenuFor(board)}
      targets={connectTargets(graph, board.id)}
      onAdd={(item) => onAdd(board, item)}
      onConnect={(target) => onConnect(board.id, target)}
      onRun={() => commands.requestRun(board.id)}
      onRunDownstream={() => commands.requestRunDownstream(board.id)}
      onMove={(key, shift) => move(board, nudge(board, key, shift), shift ? "ten steps" : "one step")}
      extra={<BoardDoors board={board} graph={graph} canvasId={canvasId} />}
      detachedLists
    />
  );

  const renderBoard = (board: BoardView, panning: () => boolean) => {
    const selection = store.getState().selection;
    const garment = board.kind === "garment";
    const design = designOf(board);
    return (
      <CanvasBoard
        key={board.id}
        id={board.id}
        box={boxOf(board)}
        scale={store.getState().viewport.scale}
        label={nameOf(board)}
        kindLabel={BOARDS[board.kind].label}
        selected={selection.includes(board.id)}
        busy={busy}
        panning={panning}
        onPress={(additive) => (additive ? store.toggle(board.id) : store.select(board.id))}
        onDragged={(by) => dragged(board, by)}
        onKey={onKey(board)}
      >
        {garment ? (
          <div className="flex h-full flex-col gap-2 rounded-2xl bg-bg p-2 shadow-sm">
            <GarmentPreviewPanel preview={design ? (garments[design] ?? null) : null} editHref={`/project/${canvasId}?focus=${board.id}` as never} />
            <div className="h-44 shrink-0">{card(board)}</div>
          </div>
        ) : (
          card(board)
        )}
      </CanvasBoard>
    );
  };

  return (
    <>
      {/* What a keyboard move or a new connector did, for a screen reader. Never a visual change. */}
      <p aria-live="polite" className="sr-only" data-testid="flow-canvas-said">
        {said}
      </p>
      <InfiniteCanvas graph={graph} renderBoard={renderBoard} initialScale={zoom / 100}>
        <div
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            setMenu(null);
            setConnecting(null);
          }}
        >
          <BoardMenus graph={graph} menu={menu} connecting={connecting} onAdd={onAdd} onConnect={(board, target) => onConnect(board.id, target)} />
        </div>
      </InfiniteCanvas>
    </>
  );
}
