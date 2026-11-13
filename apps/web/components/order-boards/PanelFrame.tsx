"use client";

import { ChevronLeft, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { PANEL_TRIGGER } from "./OrderBoardsContext";

/**
 * The frame of the Share and Export popovers and the Order drawer (`10` §8 Popover; `08` v3.6:
 * "under the Export button, no dimming"; the Order drawer is "styled like the Share popover but
 * taller"). White, r-2xl, e3, fixed to the top right of the window below the right panel's header,
 * so it sits under the Share · Export · Order buttons wherever they are mounted.
 *
 * A non-modal dialog: focus moves into it when it opens; Esc, ×, or a press outside it closes it.
 * A press on a panel's own trigger is left to the trigger, which toggles it.
 */

const WIDTHS = { 400: "w-100", 440: "w-110", 480: "w-120" } as const;

type Props = Readonly<{
  title: string;
  onClose: () => void;
  /** A sub-view's way back, such as Publish project's ‹. */
  onBack?: () => void;
  width?: keyof typeof WIDTHS;
  testId: string;
  children: ReactNode;
}>;

export function PanelFrame({ title, onClose, onBack, width = 400, testId, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panel.current?.contains(target) || target.closest(`[${PANEL_TRIGGER}]`)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      data-testid={testId}
      className={cx(
        "fixed top-16 right-4 z-[70] flex max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-bg p-4.5 text-body text-text shadow-e3 outline-none motion-safe:pop-in",
        WIDTHS[width],
      )}
    >
      <div className="flex items-center gap-2">
        {onBack ? <Button variant="ghost" size="sm" iconOnly icon={<Icon icon={ChevronLeft} />} aria-label="Back" onClick={onBack} /> : null}
        <h2 className="min-w-0 flex-1 truncate text-body-lg font-semibold text-text">{title}</h2>
        <Button variant="ghost" size="sm" iconOnly icon={<Icon icon={X} />} aria-label={`Close ${title}`} onClick={onClose} />
      </div>
      {children}
    </div>
  );
}
