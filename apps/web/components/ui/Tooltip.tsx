"use client";

import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { cx } from "./cx";

/**
 * A tooltip (docs/spec/10-design-system.md §8): `text` fill, white 12/500, r-sm, 6 × 8 px
 * padding, after a 400 ms hover. Keyboard focus shows it at once; Esc hides it.
 *
 * The text is always in the page (hidden until shown) and named by the trigger's
 * `aria-describedby`, so a screen reader hears it without hovering. That is how a disabled
 * button says why (§8 "disabled: a tooltip saying why").
 */

export const TOOLTIP_DELAY_MS = 400;

type TooltipProps = Readonly<{
  content: string;
  /** One element that can take focus. It receives `aria-describedby`. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  delay?: number;
  className?: string;
}>;

const SIDE = {
  top: "bottom-[calc(100%+6px)]",
  bottom: "top-[calc(100%+6px)]",
} as const;

export function Tooltip({ content, children, side = "top", delay = TOOLTIP_DELAY_MS, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const later = () => {
    clear();
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clear();
    setOpen(false);
  };
  useEffect(() => clear, []);

  const own = children.props["aria-describedby"];
  return (
    <span
      className={cx("relative inline-flex", className)}
      onPointerEnter={later}
      onPointerLeave={hide}
      onFocus={() => setOpen(true)}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") hide();
      }}
    >
      {cloneElement(children, { "aria-describedby": own ? `${own} ${id}` : id })}
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cx(
          "pointer-events-none absolute left-1/2 z-[80] w-max max-w-64 -translate-x-1/2 rounded-sm bg-text px-2 py-1.5 text-caption text-on-dark shadow-e2 motion-safe:fade-in",
          SIDE[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}
