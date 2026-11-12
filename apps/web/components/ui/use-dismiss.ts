"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a floating thing (a menu, a popover) the ways §8 asks: Esc, or a press outside it and
 * its trigger. After Esc focus goes back to the trigger, so a keyboard user is where they were.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  inside: readonly RefObject<HTMLElement | null>[],
  trigger: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && inside.some((ref) => ref.current?.contains(target))) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, inside, trigger]);
}
