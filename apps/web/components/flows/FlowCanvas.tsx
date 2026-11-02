"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  addMenuFor,
  connectorsOf,
  connectTargets,
  CARD_SIZE,
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

/**
 * A board is drawn at a readable size whatever its artboard is: the canvas is a map of the flow, not
 * a preview of it. `CARD_SIZE` is the one place that size lives, because the dots and the curves are
 * worked out from it too -- `lib/flows/canvas.ts`.
 */
const CARD = CARD_SIZE;
const PAD = 64;

/** Everything on a card that a press belongs to rather than to a drag of the card. */
const CONTROLS = "button, a, input, select, textarea, summary, [role='button']";

/** True when a pointer went down on one of a card's own controls. */
const isControl = (target: EventTarget | null): boolean => target instanceof Element && target.closest(CONTROLS) !== null;

export function FlowCanvas({ graph, selectedId, zoom, busy, commands, running = {} }: FlowCanvasProps) {
  const [menu, setMenu] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const dragging = useRef<Readonly<{ id: string; from: Point }> | null>(null);
  const extent = extentOf(graph, CARD);
  const connectors = connectorsOf(graph, CARD);

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
    // An open menu owns its own arrow keys: inside the connect list they scroll and move focus, and
    // a board that moved under the person's hand while they were reading a list would be a surprise.
    if ((menu === board.id || connecting === board.id) && event.target !== event.currentTarget) {
      if (event.key === "Escape") {
        setMenu(null);
        setConnecting(null);
      }
      return;
    }
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
          className="pointer-events-none absolute"
          width={extent.width + PAD * 2}
          height={extent.height + PAD * 2}
          style={{ left: PAD - extent.x, top: PAD - extent.y }}
        >
          {connectors.map((connector) => (
            <path key={connector.edgeId} d={connector.path} fill="none" stroke="rgba(130,150,255,0.55)" strokeWidth={2} />
          ))}
        </svg>

        <ul className="absolute inset-0">
          {graph.boards.map((board) => (
            <li key={board.id} className="absolute" style={place(board)}>
              <div
                role="group"
                aria-label={`${board.name || BOARDS[board.kind].label}, ${inputState(graph, board)}`}
                tabIndex={-1}
                onKeyDown={onKey(board)}
                onPointerDown={(event) => {
                  if (busy || event.button !== 0) return;
                  // A press on a control belongs to that control, not to a drag. Capturing the
                  // pointer here would retarget the click that follows to this wrapper -- the
                  // compatibility mouse events go to the capturing element -- so Select, Add…,
                  // Connect from here and Regenerate would never see a click at all.
                  if (isControl(event.target)) return;
                  // The pointer is captured, or a drag that ends outside the 248 px card -- which is
                  // every drag worth making, since the columns are 360 px apart -- never reports.
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragging.current = { id: board.id, from: { x: event.clientX, y: event.clientY } };
                }}
                onPointerUp={(event) => {
                  const start = dragging.current;
                  dragging.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  if (!start || start.id !== board.id) return;
                  const by = { x: event.clientX - start.from.x, y: event.clientY - start.from.y };
                  if (Math.abs(by.x) < 4 && Math.abs(by.y) < 4) return;
                  move(board, dragTo(board, by), "by hand");
                }}
                onPointerCancel={() => {
                  dragging.current = null;
                }}
                onLostPointerCapture={() => {
                  dragging.current = null;
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
