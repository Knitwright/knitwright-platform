"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { cx } from "./cx";
import { useDismiss } from "./use-dismiss";

/**
 * A popover (docs/spec/10-design-system.md §8): Export, Share, Order, Version history. White,
 * r-2xl, e3, 18 px padding, a fixed width (Export 360, Share 400, Version history 360), anchored
 * 8 px below its trigger. Esc, a press outside, or the trigger again closes it.
 *
 * It is a non-modal dialog: focus moves into it when it opens and back to the trigger on Esc.
 */

const WIDTHS = { 360: "w-90", 400: "w-100" } as const;

type PopoverProps = Readonly<{
  /** The trigger's words. */
  label: string;
  /** The dialog's name, when it differs from the trigger's words. */
  title?: string;
  width?: keyof typeof WIDTHS;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  align?: "start" | "end";
  /** The content, or a function given `close` for a button that finishes the job. */
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
}>;

export function Popover({ label, title, width = 360, icon, variant = "secondary", size = "md", align = "end", children, className }: PopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const [inside] = useState(() => [panel, trigger]);
  useDismiss(open, close, inside, trigger);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  return (
    <span className={cx("relative inline-flex", className)}>
      <Button
        ref={trigger}
        variant={variant}
        size={size}
        icon={icon}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        {label}
      </Button>
      {open ? (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={title ?? label}
          tabIndex={-1}
          className={cx(
            "absolute top-[calc(100%+8px)] z-[70] flex max-w-[calc(100vw-32px)] flex-col gap-3 rounded-2xl border border-border bg-bg p-4.5 text-body text-text shadow-e3 outline-none motion-safe:pop-in",
            WIDTHS[width],
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </span>
  );
}
