"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cx } from "@/components/ui/cx";
import { useDismiss } from "@/components/ui/use-dismiss";

/**
 * A menu panel for the editor's chrome (`10` §8 "Menu": white, r-2xl, e3, 8 px padding), opened
 * beside its trigger in whichever direction the chrome needs -- right of the rail's ≡, above the
 * dock, below the task bar -- or at a point, for a right-click.
 *
 * Keyboard as the design system's menu: it opens on its first item, the arrows, Home and End move
 * between items, Esc closes it and puts focus back on the trigger, and Tab closes it.
 */

export type MenuPlace = "right" | "above" | "below" | "below-end" | Readonly<{ x: number; y: number }>;

type Props = Readonly<{
  id: string;
  label: string;
  open: boolean;
  onClose: () => void;
  trigger: RefObject<HTMLElement | null>;
  place: MenuPlace;
  className?: string;
  children: ReactNode;
}>;

const PLACES: Readonly<Record<Exclude<MenuPlace, object>, string>> = {
  right: "absolute top-0 left-[calc(100%+12px)]",
  above: "absolute bottom-[calc(100%+10px)] left-0",
  below: "absolute top-[calc(100%+8px)] left-0",
  "below-end": "absolute top-[calc(100%+8px)] right-0",
};

const ITEMS = '[role="menuitem"]:not([disabled]),[role="menuitemradio"]:not([disabled]),[role="menuitemcheckbox"]:not([disabled])';

export function FloatingMenu({ id, label, open, onClose, trigger, place, className, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [inside] = useState(() => [panel, trigger]);
  useDismiss(open, onClose, inside, trigger);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, [open]);

  if (!open) return null;

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") return onClose();
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to =
      event.key === "ArrowDown" ? (at + 1) % items.length : event.key === "ArrowUp" ? (at - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (to < 0 || items.length === 0) return;
    event.preventDefault();
    items[to]?.focus();
  };

  const point = typeof place === "object";
  const style: CSSProperties | undefined = point ? { left: place.x, top: place.y } : undefined;
  return (
    <div
      ref={panel}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={onKey}
      style={style}
      className={cx(
        "z-[70] flex min-w-56 flex-col rounded-2xl border border-border bg-bg p-2 text-left shadow-e3 motion-safe:pop-in",
        point ? "fixed" : PLACES[place],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One row of a floating menu: 40 px, r-md, 15/500 `text-2`, hover `soft` (`10` §8). */
export const MENU_ROW =
  "flex h-10 w-full shrink-0 items-center gap-3 rounded-md px-3 text-left text-body-lg font-medium whitespace-nowrap text-text-2 no-underline outline-none hover:bg-soft focus-visible:bg-soft disabled:cursor-not-allowed disabled:opacity-40";

export const MenuRule = () => <div role="separator" className="mx-1 my-1.5 h-px shrink-0 bg-border" />;
