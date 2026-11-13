"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { canvasKey, isPanKey, rectFromPoints, screenToWorld, type CanvasKeyAction, type CanvasStore, type Point, type Rect } from "@/lib/canvas";

/**
 * How a person moves the plane (`08` §5.1): the wheel pans and Ctrl/⌘-wheel (and a trackpad pinch,
 * which the browser sends as one) zooms about the pointer; Space-drag and the middle button pan;
 * a drag on the empty canvas draws a marquee; + / − / 0 / 1 zoom. Everything is a store command,
 * so what the hook does is read the event and name the command.
 */

type Drag = Readonly<{ mode: "pan" | "marquee"; last: Point; moved: boolean; additive: boolean }>;

export type ViewportInput = Readonly<{
  /** True while Space is held, so a board hands its press to the pan. */
  panning: () => boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLElement>) => void;
}>;

type Options = Readonly<{
  store: CanvasStore;
  /** The boards a marquee may catch, as ids for the world rectangle it covers. */
  catches: (rect: Rect) => readonly string[];
  /** Fit to content, for the 0 key. */
  fit: () => void;
}>;

const local = (element: HTMLElement, event: Readonly<{ clientX: number; clientY: number }>): Point => {
  const frame = element.getBoundingClientRect();
  return { x: event.clientX - frame.left, y: event.clientY - frame.top };
};

export function useViewportInput(ref: RefObject<HTMLElement | null>, { store, catches, fit }: Options): ViewportInput {
  const space = useRef(false);
  const drag = useRef<Drag | null>(null);

  // A wheel listener has to be registered by hand to be allowed to prevent the page's own scroll.
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) store.zoomWheel(event.deltaY, local(element, event));
      else store.panBy({ x: -event.deltaX, y: -event.deltaY });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref, store]);

  const zoom = (action: CanvasKeyAction): void => {
    if (action === "zoom-in") store.zoomStep(1);
    else if (action === "zoom-out") store.zoomStep(-1);
    else if (action === "actual") store.zoomTo(1);
    else fit();
  };

  return {
    panning: () => space.current,
    onPointerDown(event) {
      const pan = event.button === 1 || (event.button === 0 && space.current);
      const empty = event.button === 0 && event.target === event.currentTarget;
      if (!pan && !empty) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const at = local(event.currentTarget, event);
      drag.current = { mode: pan ? "pan" : "marquee", last: at, moved: false, additive: event.shiftKey };
      if (!pan) store.beginMarquee(screenToWorld(store.getState().viewport, at));
    },
    onPointerMove(event) {
      const now = drag.current;
      if (now === null) return;
      const at = local(event.currentTarget, event);
      if (now.mode === "pan") store.panBy({ x: at.x - now.last.x, y: at.y - now.last.y });
      else store.moveMarquee(screenToWorld(store.getState().viewport, at));
      drag.current = { ...now, last: at, moved: now.moved || Math.abs(at.x - now.last.x) + Math.abs(at.y - now.last.y) > 0 };
    },
    onPointerUp(event) {
      const now = drag.current;
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (now?.mode !== "marquee") return;
      const marquee = store.getState().marquee;
      // A click on the empty canvas, with nothing dragged, clears the selection.
      const caught = marquee !== null && now.moved ? catches(rectFromPoints(marquee.from, marquee.to)) : [];
      store.endMarquee(caught, now.additive);
    },
    onKeyDown(event) {
      if (isPanKey(event)) {
        if (event.target === event.currentTarget) event.preventDefault();
        space.current = true;
        return;
      }
      if (event.key === "Escape") {
        store.select(null);
        return;
      }
      const action = canvasKey(event);
      if (action === null) return;
      event.preventDefault();
      zoom(action);
    },
    onKeyUp(event) {
      if (event.key === " ") space.current = false;
    },
  };
}

