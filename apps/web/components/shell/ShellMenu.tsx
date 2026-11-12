"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cx } from "@/components/ui/cx";
import { moveIndex } from "@/components/ui/keys";
import { useDismiss } from "@/components/ui/use-dismiss";
import { closeFor, openAtFor, startIndex, type OpenAt } from "@/lib/shell/menu-keys";

/**
 * A menu of the shell (decision 0138): the Create popover, ⋯, Help, ⊕ and the avatar menu.
 *
 * It is U1's `Menu` (decision 0137) with two differences the shell needs: the trigger is drawn by
 * the caller (a rail item, a round icon, the avatar), and the entries are links, so a place opens
 * with an ordinary navigation and can be opened in a new tab. Same panel (white, r-2xl, e3, 8 px),
 * same keys (`lib/shell/menu-keys.ts`), same dismissal (U1's `useDismiss`), and it closes by itself
 * when the address changes.
 */

export type TriggerProps = Readonly<{
  ref: Ref<HTMLButtonElement>;
  type: "button";
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}>;

type ShellMenuProps = Readonly<{
  /** The menu's name, for a screen reader. */
  label: string;
  trigger: (props: TriggerProps) => ReactNode;
  /** Rail menus open to the right of their trigger; top-bar menus open below it. */
  side?: "right" | "below";
  align?: "start" | "end";
  /** Words above the entries that are not entries themselves, such as the address signed in. */
  header?: ReactNode;
  /** The entries: `MenuItemLink`s, separators and the sign-out item. */
  children: ReactNode;
  className?: string;
}>;

const ITEM = '[role="menuitem"]:not([disabled])';

const PLACE = {
  right: { start: "left-[calc(100%+8px)] top-0", end: "left-[calc(100%+8px)] bottom-0" },
  below: { start: "left-0 top-[calc(100%+8px)]", end: "right-0 top-[calc(100%+8px)]" },
} as const;

const itemsOf = (panel: HTMLElement | null): HTMLElement[] => (panel ? [...panel.querySelectorAll<HTMLElement>(ITEM)] : []);

export function ShellMenu({ label, trigger, side = "below", align = "start", header, children, className }: ShellMenuProps) {
  const id = useId();
  const path = usePathname();
  // The address the menu was opened at: a new address closes it with no effect to run.
  const [opened, setOpened] = useState<Readonly<{ at: string; start: OpenAt }> | null>(null);
  const open = opened !== null && opened.at === path;
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpened(null), []);
  const [inside] = useState(() => [panel, button]);
  useDismiss(open, close, inside, button);

  useEffect(() => {
    if (!open || opened === null) return;
    const items = itemsOf(panel.current);
    const index = startIndex(opened.start, items.length);
    if (index !== null) items[index]?.focus();
  }, [open, opened]);

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = openAtFor(event.key);
    if (at === null || open) return;
    event.preventDefault();
    setOpened({ at: path, start: at });
  };

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const ending = closeFor(event.key);
    if (ending === "release") return close();
    if (ending === "refocus") return; // useDismiss closes and refocuses.
    const items = itemsOf(panel.current);
    const next = moveIndex(items.indexOf(document.activeElement as HTMLElement), event.key, items.length, "vertical");
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div className={cx("relative", className)}>
      {trigger({
        ref: button,
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        onClick: () => (open ? close() : setOpened({ at: path, start: "first" })),
        onKeyDown: onTriggerKey,
      })}
      {open ? (
        <div
          ref={panel}
          id={id}
          onKeyDown={onPanelKey}
          className={cx(
            "absolute z-[70] flex max-h-[calc(100dvh-96px)] min-w-60 flex-col overflow-y-auto rounded-2xl border border-border bg-bg p-2 text-left shadow-e3 motion-safe:pop-in",
            PLACE[side][align],
          )}
        >
          {header}
          <div role="menu" aria-label={label} className="flex flex-col">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
