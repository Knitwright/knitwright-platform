"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FOCUSABLE, menuButtonProps, menuPanelProps } from "@/lib/shell/menu-a11y";
import { trapTarget } from "@/lib/workspace/focus-trap";

/**
 * The glass panel the top bar's menus drop down. It was the phone's menu alone; decision 0102 made
 * it the bar's one menu at every width, so the account cluster and the sections past the fourth
 * each open one of these rather than taking room in the row.
 *
 * It is a disclosure, not a hover panel: it opens on a click or a press, closes on Escape, on a
 * click outside it and on a new address, and gives focus back to its own button when it closes.
 * While it is open Tab goes round the button and the panel's own controls and leaves neither.
 */
type GlassMenuProps = Readonly<{
  /** The words on the button. */
  label: string;
  /** The panel's own name, for a screen reader. */
  panelLabel: string;
  /** Added to the button's name without being shown, such as which section is current. */
  note?: string | null;
  /** True when the button should read as the current place, for the overflow menu. */
  current?: boolean;
  /** Where the menu sits, and at which widths. */
  className?: string;
  children: ReactNode;
}>;

const BUTTON =
  "nav-pill inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3.5 text-sm font-medium";

export function GlassMenu({ label, panelLabel, note = null, current = false, className, children }: GlassMenuProps) {
  const path = usePathname();
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /*
   * The address the menu was opened at, rather than a plain `open` flag: a new address then closes
   * it by itself, with no effect that sets state while the page is changing under it.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === path;
  const setOpen = (next: boolean) => setOpenedAt(next ? path : null);

  // The first thing in the panel takes focus, so a keyboard reaches the menu's contents at once.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpenedAt(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((control) => control.offsetParent !== null);
    const target = trapTarget(controls.length, controls.indexOf(document.activeElement as HTMLElement), event.shiftKey);
    if (target === null) return;
    event.preventDefault();
    controls[target]?.focus();
  };

  return (
    <div ref={wrapper} onKeyDown={keys} className={`relative ${className ?? ""}`}>
      <button
        ref={button}
        {...menuButtonProps(panelId, open)}
        onClick={() => setOpen(!open)}
        className={`${BUTTON} ${current ? "bg-white/12 text-white" : "text-ink"}`}
      >
        <span>{label}</span>
        {note ? <span className="sr-only">{note}</span> : null}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="M1.5 4L6 8.5L10.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          ref={panel}
          {...menuPanelProps(panelId, panelLabel)}
          className="panel-in absolute right-0 top-[calc(100%+12px)] z-50 flex w-64 flex-col gap-2 rounded-3xl border border-white/15 bg-surface-solid/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
