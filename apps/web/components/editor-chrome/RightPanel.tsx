"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { useDismiss } from "@/components/ui/use-dismiss";
import type { LaunchPanelProps } from "@/lib/launch";
import { POPOVER_SLOTS, type PopoverSlot } from "./slots";

/**
 * THE RIGHT PANEL (`08` §5.1 and §5.3; prototype e01 and e15; decision 0146), 310 px and always
 * there: **Share · Export · Order** on top, then the project's name with its version history, then
 * the inspector -- the project's colours and tools with nothing selected (`ProjectPanel`), or the
 * selected board's own inspector (`components/launch/Inspector.tsx`, E3's to fill).
 *
 * The three buttons open E4's Share popover, Export popover and Order drawer (`slots.ts`, decision
 * 0148). The doors the interim popovers offered -- the tech pack page, the Make page, the board's
 * file, the members' settings, the Orders area -- are kept inside them.
 */

type Props = Readonly<{
  projectName: string;
  panel: LaunchPanelProps;
  /** E5's doors by the project's name (decision 0149): Add board and the version-history clock. */
  doors: ReactNode;
  children: ReactNode;
}>;

export function RightPanel({ projectName, panel, doors, children }: Props) {
  return (
    <div className="relative flex w-full shrink-0 flex-col overflow-y-auto border-l border-border bg-bg text-body lg:h-full lg:w-77.5" data-testid="editor-right-panel">
      <div role="group" aria-label="Share, export and order" className="flex items-center justify-end gap-2 px-4 pt-3.5 pb-1">
        <ChromePopover slot="share" label="Share" tone="plain" panel={panel} />
        <ChromePopover slot="export" label="Export" tone="ink" panel={panel} />
        <ChromePopover slot="order" label="Order" tone="gold" panel={panel} />
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 pt-3.5 pb-4.5 text-body-lg text-muted">
        <h1 className="min-w-0 truncate text-body-lg font-medium text-muted">{projectName}</h1>
        {doors}
      </div>
      {children}
    </div>
  );
}

const TONES = {
  plain: "border border-border bg-bg text-text hover:bg-soft",
  ink: "bg-text text-on-dark hover:bg-text-2",
  gold: "bg-gold text-navy hover:bg-gold-2",
} as const;

function ChromePopover({ slot, label, tone, panel }: Readonly<{ slot: PopoverSlot; label: string; tone: keyof typeof TONES; panel: LaunchPanelProps }>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const [inside] = useState(() => [box, trigger]);
  useDismiss(open, close, inside, trigger);
  const Filled = POPOVER_SLOTS[slot];

  return (
    <span className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        className={cx("h-10 rounded-md px-3 text-body font-semibold transition-colors duration-fast", TONES[tone])}
        data-testid={`editor-${slot}`}
      >
        {label}
      </button>
      {open && Filled ? (
        // E4's panels bring their own frame and dialog (decision 0148); this box only keeps them "inside".
        <div ref={box} id={id} className="contents" data-testid={`editor-${slot}-popover`}>
          <Filled {...panel} close={close} />
        </div>
      ) : null}
    </span>
  );
}
