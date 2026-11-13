"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Point, Rect } from "@/lib/canvas";

/**
 * One board on the plane (decision 0145): placed at its box in world units, so it pans and zooms
 * with the plane, with its label above the top-left corner at a steady screen size (`08` §5.2,
 * `10` "Canvas (editor)": 13 px, muted, the text colour when selected; a 2 px electric outline).
 *
 * A press that is not on one of the board's own controls is the board's: a click selects it (Shift
 * adds it to the selection) and a drag moves it -- every selected board with it -- by the distance
 * in world units. The keyboard has the same three things on the board itself: Enter selects it and
 * moves into its controls, the arrows nudge it, Tab moves to the next board in reading order.
 */

/** Everything on a board that a press belongs to rather than to a drag of the board. */
const CONTROLS = "button, a, input, select, textarea, summary, [role='button'], [role='menuitem']";

const isControl = (target: EventTarget | null): boolean => target instanceof Element && target.closest(CONTROLS) !== null;

/** How far a press may wander and still be a click. */
const CLICK_SLOP = 4;

export type CanvasBoardProps = Readonly<{
  id: string;
  box: Rect;
  /** The plane's scale, so the label keeps its screen size. */
  scale: number;
  label: string;
  /** What the board is, for the label's eyebrow and its accessible name. */
  kindLabel: string;
  selected: boolean;
  busy: boolean;
  /** True while Space is held: then a press pans the canvas instead. */
  panning: () => boolean;
  onPress: (additive: boolean) => void;
  /** A drag ended, by this far in world units. */
  onDragged: (by: Point) => void;
  onKey: (event: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}>;

export function CanvasBoard(props: CanvasBoardProps) {
  const { box, scale, selected } = props;
  const start = useRef<Point | null>(null);
  const [offset, setOffset] = useState<Point | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (props.busy || event.button !== 0 || props.panning() || isControl(event.target)) return;
    // Captured, so a drag that leaves the board still reports, and the press does not reach the
    // canvas underneath as the start of a marquee.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (start.current === null) return;
    setOffset({ x: (event.clientX - start.current.x) / scale, y: (event.clientY - start.current.y) / scale });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const from = start.current;
    start.current = null;
    setOffset(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (from === null) return;
    const moved = { x: event.clientX - from.x, y: event.clientY - from.y };
    if (Math.abs(moved.x) < CLICK_SLOP && Math.abs(moved.y) < CLICK_SLOP) {
      props.onPress(event.shiftKey);
      return;
    }
    props.onDragged({ x: moved.x / scale, y: moved.y / scale });
  };

  const place: CSSProperties = {
    left: box.x + (offset?.x ?? 0),
    top: box.y + (offset?.y ?? 0),
    width: box.width,
    height: box.height,
  };

  return (
    <li className="absolute" style={place} data-board-box={props.id}>
      {/* The label sits above the board and is scaled back, so it reads the same at every zoom. */}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-full left-0 mb-1 origin-bottom-left truncate text-small font-semibold whitespace-nowrap ${selected ? "text-text" : "text-muted"}`}
        style={{ transform: `scale(${1 / scale})`, maxWidth: box.width * scale }}
      >
        {props.label}
      </p>
      <div
        role="group"
        aria-label={`${props.label}, ${props.kindLabel} board${selected ? ", selected" : ""}`}
        tabIndex={0}
        data-board-id={props.id}
        onKeyDown={props.onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setOffset(null);
        }}
        className={`h-full rounded-2xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-electric ${selected ? "ring-2 ring-electric" : ""}`}
      >
        {props.children}
      </div>
    </li>
  );
}
