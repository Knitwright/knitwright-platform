"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  addMenuFor,
  connectorsOf,
  connectTargets,
  dragTo,
  extentOf,
  inputState,
  isArrowKey,
  nudge,
  type AddItem,
  type ConnectTarget,
} from "@/lib/flows";
import { BOARDS, type BoardKind, type BoardView, type Graph, type LaunchCommands, type Point } from "@/lib/launch";
import { FlowBoardCard } from "./FlowBoardCard";

/**
 * THE FLOW CANVAS (spec F-L4): boards where the person put them, curved connectors from each
 * board's right-edge dot, an Add… menu on that dot, fan-out and fan-in.
 *
 * L1's canvas lays the boards out in a row and scrolls; it left the places, the curves and the
 * dragging to this workstream and put `moveBoard` in the contract for it.
 *
 * **IT WORKS WITHOUT A MOUSE.** A node canvas that needs dragging is a canvas half the people who
 * open it cannot use, so each of the three things a person does here has a keyboard path:
 *
 *   * *selecting* -- the boards are a list in reading order, so Tab reaches every one, and the
 *     board's own button says what pressing it does;
 *   * *moving* -- the arrow keys nudge the selected board by the grid and Shift by ten of them,
 *     through the same `moveBoard` a drag uses. The live region says where it went;
 *   * *connecting* -- "Connect from here" opens a list of the boards this one may feed, each with
 *     the input it would take and, where it would be refused, L1's own words for why. A connector
 *     is drawn by choosing from a list rather than by aiming at a dot.
 *
 * The maths is all in `lib/flows/canvas.ts` and tested there; this file is the screen.
 */

export type FlowCanvasProps = Readonly<{
  graph: Graph;
  selectedId: string | null;
  zoom: number;
  busy: boolean;
  commands: LaunchCommands;
  /** What is happening to each board right now, by board id, for the per-board progress line. */
  running?: Readonly<Record<string, string>>;
}>;

/** The dotted ground, drawn here rather than in the shared stylesheet, which this workstream does not own. */
const DOTS: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

/** A board is drawn at a readable size whatever its artboard is: the canvas is a map, not a preview. */
const CARD = { width: 248, height: 168 } as const;
const PAD = 64;

export function FlowCanvas({ graph, selectedId, zoom, busy, commands, running = {} }: FlowCanvasProps) {
  const [menu, setMenu] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const dragging = useRef<Readonly<{ id: string; from: Point }> | null>(null);
  const extent = extentOf(graph);
  const connectors = connectorsOf(graph);

  /** Canvas pixels to screen pixels: the boards keep their places and the cards keep their size. */
  const place = (board: BoardView): CSSProperties => ({
    left: board.at.x - extent.x + PAD,
    top: board.at.y - extent.y + PAD,
    width: CARD.width,
    height: CARD.height,
  });

  const move = (board: BoardView, at: Point, how: string): void => {
    commands.moveBoard(board.id, at);
    setSaid(`${board.name || BOARDS[board.kind].label} moved ${how} to ${at.x}, ${at.y}.`);
  };

  const onKey = (board: BoardView) => (event: KeyboardEvent<HTMLDivElement>): void => {
    if (busy) return;
    if (isArrowKey(event.key)) {
      event.preventDefault();
      move(board, nudge(board, event.key, event.shiftKey), event.shiftKey ? "ten steps" : "one step");
      return;
    }
    if (event.key === "Escape") {
      setMenu(null);
      setConnecting(null);
    }
  };

  const onConnect = (fromBoardId: string, target: ConnectTarget): void => {
    if (target.inputIndex === null || target.blocked !== null) return;
    commands.connect(fromBoardId, target.boardId, target.inputIndex);
    setConnecting(null);
    setSaid(`Connected into input ${target.inputIndex} of ${target.name}.`);
  };

  const onAdd = (board: BoardView, item: AddItem): void => {
    commands.addBoard(item.kind, { x: board.at.x + 360, y: board.at.y }, board.id);
    setMenu(null);
    setSaid(`${item.label} board added after ${board.name || BOARDS[board.kind].label}.`);
  };

  return (
    <section
      aria-label="Flow canvas"
      data-testid="flow-canvas"
      style={DOTS}
      className="relative flex min-h-0 flex-1 flex-col overflow-auto rounded-3xl border border-hairline bg-surface-solid"
    >
      {/* What a keyboard move or a new connector did, for a screen reader. Never a visual change. */}
      <p aria-live="polite" className="sr-only" data-testid="flow-canvas-said">
        {said}
      </p>

      <div
        className="relative"
        style={{ width: extent.width + PAD * 2, height: extent.height + PAD * 2, zoom: `${zoom}%` }}
        data-testid="flow-canvas-sheet"
      >
        {/* The connectors, under the boards, and out of the accessibility tree: each one is read
            out on the board it ends at instead, where a person can also cut it. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ left: PAD - extent.x, top: PAD - extent.y }}
        >
          {connectors.map((connector) => (
            <path key={connector.edgeId} d={connector.path} fill="none" stroke="rgba(130,150,255,0.55)" strokeWidth={2} />
          ))}
        </svg>

        <ul className="contents">
          {graph.boards.map((board) => (
            <li key={board.id} className="absolute" style={place(board)}>
              <div
                role="group"
                aria-label={`${board.name || BOARDS[board.kind].label}, ${inputState(graph, board)}`}
                tabIndex={-1}
                onKeyDown={onKey(board)}
                onPointerDown={(event) => {
                  if (busy || event.button !== 0) return;
                  dragging.current = { id: board.id, from: { x: event.clientX, y: event.clientY } };
                }}
                onPointerUp={(event) => {
                  const start = dragging.current;
                  dragging.current = null;
                  if (!start || start.id !== board.id) return;
                  const by = { x: event.clientX - start.from.x, y: event.clientY - start.from.y };
                  if (Math.abs(by.x) < 4 && Math.abs(by.y) < 4) return;
                  move(board, dragTo(board, by), "by hand");
                }}
                className="h-full"
              >
                <FlowBoardCard
                  board={board}
                  graph={graph}
                  selected={board.id === selectedId}
                  busy={busy}
                  progress={running[board.id] ?? null}
                  menuOpen={menu === board.id}
                  connectingOpen={connecting === board.id}
                  onSelect={() => commands.selectBoard(board.id === selectedId ? null : board.id)}
                  onMenu={() => setMenu(menu === board.id ? null : board.id)}
                  onConnecting={() => setConnecting(connecting === board.id ? null : board.id)}
                  addItems={addMenuFor(board)}
                  targets={connectTargets(graph, board.id)}
                  onAdd={(item) => onAdd(board, item)}
                  onConnect={(target) => onConnect(board.id, target)}
                  onRun={() => commands.requestRun(board.id)}
                  onRunDownstream={() => commands.requestRunDownstream(board.id)}
                  onMove={(key, shift) => move(board, nudge(board, key, shift), shift ? "ten steps" : "one step")}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The kinds the inspector's Tools list offers, in the spec's own order. */
export const CANVAS_TOOLS: readonly BoardKind[] = ["mockup", "ai_image", "ai_video", "marketing", "info_card"];
