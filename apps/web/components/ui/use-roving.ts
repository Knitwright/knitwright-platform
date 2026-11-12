"use client";

import { useRef, type KeyboardEvent } from "react";
import { moveIndex, type Orientation } from "./keys";

/**
 * Roving focus for a row of choices (tabs, a segmented control, a menu): one of them is in the
 * tab order, and the arrow keys, Home and End move focus along the row (`keys.ts`). `onMove`
 * hears the new index, so a tab list can select as it moves.
 */
export function useRoving<T extends HTMLElement>(
  count: number,
  onMove: (index: number) => void,
  orientation: Orientation = "horizontal",
  enabled?: (index: number) => boolean,
) {
  const items = useRef<(T | null)[]>([]);
  const onKeyDown = (index: number) => (event: KeyboardEvent<T>) => {
    const next = moveIndex(index, event.key, count, orientation, enabled);
    if (next === null) return;
    event.preventDefault();
    items.current[next]?.focus();
    onMove(next);
  };
  const ref = (index: number) => (element: T | null) => {
    items.current[index] = element;
  };
  const focus = (index: number) => items.current[index]?.focus();
  return { onKeyDown, ref, focus };
}
