"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { initialFocus, trapTab } from "@/components/ui/Modal";

/**
 * Kittl's split modal (decision 0149; `08` v3.3 "Browse Styles … a split modal with the ✕ outside the
 * top-right corner", prototype e38–e40): a grey-ruled left column and a right column, r-3xl, e4, over
 * the scrim, with a round white ✕ hanging off the corner. Focus is trapped inside and goes back where
 * it was on close; Esc closes. The library `Modal` keeps its own header, so this is its sibling, built
 * from the same focus helpers.
 */

type Props = Readonly<{
  open: boolean;
  onClose: () => void;
  /** The dialog's name. Shown as the left column's heading when `left` is given. */
  title: string;
  /** A line under the heading ("All categories are optional"). */
  lead?: string;
  /** The left column below the heading. Without it the modal is one column with the heading on top. */
  left?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  testId?: string;
}>;

export function SplitModal(props: Props) {
  return props.open ? <Frame {...props} /> : null;
}

function Frame({ onClose, title, lead, left, children, size = "lg", testId }: Props) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (box.current) initialFocus(box.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (box.current) trapTab(event, box.current, document.activeElement);
  };
  const heading = (
    <div className="flex flex-col gap-1">
      <h2 id={titleId} className="text-h2 text-text">
        {title}
      </h2>
      {lead ? <p className="text-body-lg font-normal text-muted">{lead}</p> : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim motion-safe:fade-in" onClick={onClose} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        data-testid={testId}
        className={cx("relative flex h-[min(46.25rem,92vh)] w-full rounded-3xl bg-bg text-text shadow-e4 motion-safe:modal-in", size === "lg" ? "max-w-300" : "max-w-210")}
      >
        {left ? (
          <div className="hidden w-72 shrink-0 flex-col gap-5 border-r border-border p-6 md:flex">
            {heading}
            {left}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6 md:p-7">
          {left ? <div className="md:hidden">{heading}</div> : heading}
          {left ? <div className="md:hidden">{left}</div> : null}
          {children}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute -top-5 -right-5 grid size-12 place-items-center rounded-full bg-bg text-text shadow-e2 transition-colors duration-fast live:hover:bg-soft max-md:top-2 max-md:right-2"
        >
          <Icon icon={X} />
        </button>
      </div>
    </div>
  );
}
