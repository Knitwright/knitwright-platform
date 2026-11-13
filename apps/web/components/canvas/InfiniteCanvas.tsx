"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  boxOf,
  connectorsBetween,
  contentBounds,
  marqueeHits,
  rectFromPoints,
  nextInOrder,
  visibleBoards,
  visibleConnectors,
  worldToScreen,
  type Point,
} from "@/lib/canvas";
import type { BoardView, Graph } from "@/lib/launch";
import { useCanvas, useCanvasStore } from "./CanvasStore";
import { useViewportInput } from "./useViewportInput";

/**
 * THE INFINITE PLANE (plan v6 E1, decision 0145; `08` §5.1, `10` "Canvas (editor)").
 *
 * A `soft-2` ground with a dot grid every 24 units, a plane moved by one CSS transform, the
 * connectors as curved electric lines under the boards, and the boards themselves. Only the boards
 * and connectors the screen shows are put on the page (culling), so a canvas of hundreds of boards
 * costs what the screen holds; the selected boards are always kept, so focus never falls off.
 *
 * The view and the selection live in the canvas store (`lib/canvas/store.ts`), which is what the
 * chrome around the canvas reads. This file draws; `useViewportInput` reads the pointer, the wheel
 * and the keys; `CanvasBoard` is one board.
 */

export type InfiniteCanvasProps = Readonly<{
  graph: Graph;
  /** One board's content, placed and labelled by the canvas. */
  renderBoard: (board: BoardView, panning: () => boolean) => ReactNode;
  /** The view a first render opens at, given the screen: by default, the content's corner at 64 px. */
  initialScale?: number;
  /** Whatever sits over the canvas: an empty state, a notice. */
  children?: ReactNode;
}>;

const GRID = 24;
const PAD = 64;

/** The dot grid moves and scales with the plane, so the ground reads as the same surface. */
const ground = (x: number, y: number, scale: number): CSSProperties => ({
  backgroundImage: "radial-gradient(circle, var(--color-dot) 1px, transparent 1px)",
  backgroundSize: `${GRID * scale}px ${GRID * scale}px`,
  backgroundPosition: `${x}px ${y}px`,
});

export function InfiniteCanvas({ graph, renderBoard, initialScale = 1, children }: InfiniteCanvasProps) {
  const ref = useRef<HTMLElement | null>(null);
  const store = useCanvasStore();
  const viewport = useCanvas((state) => state.viewport);
  const screen = useCanvas((state) => state.screen);
  const selection = useCanvas((state) => state.selection);
  // The drag itself is read (a stable part of the state); its rectangle is worked out here, because a
  // selector that built a new object on every read would never settle.
  const dragged = useCanvas((state) => state.marquee);
  const marquee = dragged === null ? null : rectFromPoints(dragged.from, dragged.to);
  const opened = useRef(false);
  const known = useRef<ReadonlySet<string> | null>(null);

  // A board just added -- from a panel, the task bar, the Add… menu -- is brought onto the screen,
  // so what a person made is where they can see it.
  useEffect(() => {
    const before = known.current;
    known.current = new Set(graph.boards.map((board) => board.id));
    if (before === null) return;
    const added = graph.boards.filter((board) => !before.has(board.id));
    if (added.length === 1 && added[0]) store.reveal(boxOf(added[0]));
  }, [graph.boards, store]);

  const fit = () => store.fit(contentBounds(graph.boards), PAD);
  const input = useViewportInput(ref, { store, catches: (rect) => marqueeHits(graph.boards, rect), fit });

  // The screen's size, kept as the window and the panels around the canvas change; and on the
  // first measure, the view the canvas opens at.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = (): void => {
      store.setScreen({ width: element.clientWidth, height: element.clientHeight });
      if (opened.current) return;
      opened.current = true;
      const bounds = contentBounds(graph.boards);
      store.setViewport({ x: PAD - (bounds?.x ?? 0) * initialScale, y: PAD - (bounds?.y ?? 0) * initialScale, scale: initialScale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // The opening view is worked out once; later boards do not move the view under the person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // Before the screen is measured (on the server) every board is drawn: nothing is culled blind.
  const measured = screen.width > 0;
  const boards = measured ? visibleBoards(graph.boards, viewport, screen, selection) : graph.boards;
  const all = connectorsBetween(graph);
  const connectors = measured ? visibleConnectors(all, viewport, screen) : all;

  /** Tab and Shift-Tab on a board move to the next board in reading order, onto the screen. */
  const onBoardTab = (board: BoardView, event: KeyboardEvent<HTMLDivElement>): boolean => {
    if (event.key !== "Tab" || event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey) return false;
    const next = nextInOrder(graph.boards, board.id, event.shiftKey);
    const target = graph.boards.find((one) => one.id === next);
    if (!target || target.id === board.id) return false;
    event.preventDefault();
    store.select(target.id);
    store.reveal(boxOf(target));
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-board-id="${target.id}"]`)?.focus());
    return true;
  };

  const corner: Point | null = marquee === null ? null : worldToScreen(viewport, marquee);

  return (
    <section
      ref={ref}
      aria-label="Canvas"
      aria-roledescription="infinite canvas"
      data-testid="flow-canvas"
      tabIndex={-1}
      style={ground(viewport.x, viewport.y, viewport.scale)}
      onPointerDown={input.onPointerDown}
      onPointerMove={input.onPointerMove}
      onPointerUp={input.onPointerUp}
      onKeyDown={(event) => {
        const board = (event.target as HTMLElement).dataset?.boardId;
        const one = board ? graph.boards.find((candidate) => candidate.id === board) : undefined;
        if (one && onBoardTab(one, event as KeyboardEvent<HTMLDivElement>)) return;
        input.onKeyDown(event);
      }}
      onKeyUp={input.onKeyUp}
      className="relative min-h-80 flex-1 touch-none overflow-hidden rounded-3xl border border-border bg-soft-2 select-none"
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
        data-testid="canvas-plane"
        data-scale={viewport.scale}
      >
        {/* The connectors, under the boards and out of the accessibility tree: each one is read
            out on the board it ends at instead. */}
        <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
          <defs>
            <marker id="canvas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-electric)" />
            </marker>
          </defs>
          {connectors.map((connector) => (
            <path
              key={connector.edgeId}
              d={connector.path}
              fill="none"
              stroke="var(--color-electric)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#canvas-arrow)"
              data-testid={`canvas-connector-${connector.edgeId}`}
            />
          ))}
        </svg>
        <ul className="absolute top-0 left-0" data-testid="canvas-boards" data-count={boards.length}>
          {boards.map((board) => renderBoard(board, input.panning))}
        </ul>
      </div>

      {marquee && corner ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border border-electric bg-electric-soft/40"
          style={{ left: corner.x, top: corner.y, width: marquee.width * viewport.scale, height: marquee.height * viewport.scale }}
          data-testid="canvas-marquee"
        />
      ) : null}

      {children}
    </section>
  );
}

/** Tab handling for a board's own key handler: re-exported so a board can defer to the canvas. */
export type BoardKeyHandler = (board: BoardView, event: KeyboardEvent<HTMLDivElement>) => void;
