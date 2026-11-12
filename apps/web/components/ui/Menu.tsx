"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { useDismiss } from "./use-dismiss";
import { useRoving } from "./use-roving";

/**
 * A menu (docs/spec/10-design-system.md §8): white, r-2xl, e3, 8 px padding. Items are 40 px
 * (36 px `compact`), r-md, 15/500 `text-2` with a 20 px icon; hover `soft`. Separators are a
 * 1 px border with 6 px margins; shortcuts sit right in `muted` 13 px; a submenu shows a
 * chevron at the far right.
 *
 * Keyboard: Enter, Space or ↓ on the trigger opens it on the first item, ↑ on the last; arrows,
 * Home and End move; Enter chooses; Esc closes and returns focus to the trigger; Tab closes.
 */

export type MenuEntry =
  | Readonly<{
      id: string;
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      submenu?: boolean;
      danger?: boolean;
      disabled?: boolean;
      onSelect?: () => void;
    }>
  | Readonly<{ id: string; separator: true }>;

type MenuProps = Readonly<{
  /** The trigger's words, or its aria-label when `iconOnly`. */
  label: string;
  items: readonly MenuEntry[];
  icon?: ReactNode;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  compact?: boolean;
  align?: "start" | "end";
  className?: string;
}>;

const isItem = (entry: MenuEntry): entry is Extract<MenuEntry, { label: string }> => !("separator" in entry);

export function Menu({ label, items, icon, iconOnly, variant = "secondary", size = "md", compact = false, align = "start", className }: MenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<"first" | "last">("first");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const [inside] = useState(() => [panel, trigger]);
  useDismiss(open, close, inside, trigger);

  const openAt = (where: "first" | "last") => {
    setStart(where);
    setOpen(true);
  };
  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openAt(event.key === "ArrowUp" ? "last" : "first");
    }
  };
  const choose = (entry: Extract<MenuEntry, { label: string }>) => {
    setOpen(false);
    trigger.current?.focus();
    entry.onSelect?.();
  };

  return (
    <span className={cx("relative inline-flex", className)}>
      <Button
        ref={trigger}
        variant={variant}
        size={size}
        icon={icon}
        iconOnly={iconOnly}
        aria-label={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : openAt("first"))}
        onKeyDown={onTriggerKey}
      >
        {iconOnly ? null : label}
      </Button>
      {open ? (
        <MenuPanel id={id} label={label} items={items} compact={compact} align={align} start={start} panel={panel} onChoose={choose} onClose={close} />
      ) : null}
    </span>
  );
}

type PanelProps = Readonly<{
  id: string;
  label: string;
  items: readonly MenuEntry[];
  compact: boolean;
  align: "start" | "end";
  start: "first" | "last";
  panel: RefObject<HTMLDivElement | null>;
  onChoose: (entry: Extract<MenuEntry, { label: string }>) => void;
  onClose: () => void;
}>;

function MenuPanel({ id, label, items, compact, align, start, panel, onChoose, onClose }: PanelProps) {
  const usable = (index: number) => isItem(items[index]) && !(items[index] as { disabled?: boolean }).disabled;
  const roving = useRoving<HTMLButtonElement>(items.length, () => undefined, "vertical", usable);
  useEffect(() => {
    const order = items.map((_, index) => index).filter(usable);
    const first = start === "first" ? order[0] : order[order.length - 1];
    if (first !== undefined) roving.focus(first);
    // Only when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={panel}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Tab") onClose();
      }}
      className={cx(
        "absolute top-[calc(100%+8px)] z-[70] flex min-w-56 flex-col rounded-2xl border border-border bg-bg p-2 shadow-e3 motion-safe:pop-in",
        align === "end" ? "right-0" : "left-0",
      )}
    >
      {items.map((entry, index) =>
        isItem(entry) ? (
          <MenuRow key={entry.id} entry={entry} compact={compact} refFor={roving.ref(index)} onKeyDown={roving.onKeyDown(index)} onChoose={onChoose} />
        ) : (
          <div key={entry.id} role="separator" className="mx-1 my-1.5 h-px bg-border" />
        ),
      )}
    </div>
  );
}

type RowProps = Readonly<{
  entry: Extract<MenuEntry, { label: string }>;
  compact: boolean;
  refFor: (element: HTMLButtonElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onChoose: (entry: Extract<MenuEntry, { label: string }>) => void;
}>;

function MenuRow({ entry, compact, refFor, onKeyDown, onChoose }: RowProps) {
  return (
    <button
      ref={refFor}
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={entry.disabled}
      aria-haspopup={entry.submenu ? "menu" : undefined}
      onClick={() => onChoose(entry)}
      onKeyDown={onKeyDown}
      className={cx(
        "flex w-full items-center gap-3 rounded-md px-3 text-left text-body-lg font-medium whitespace-nowrap transition-colors duration-fast ease-out focus-visible:bg-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        compact ? "h-9" : "h-10",
        entry.danger ? "text-bad live:hover:bg-bad-soft" : "text-text-2 live:hover:bg-soft",
      )}
    >
      {entry.icon}
      <span className="flex-1">{entry.label}</span>
      {entry.shortcut ? <kbd className="font-sans text-small text-muted">{entry.shortcut}</kbd> : null}
      {entry.submenu ? <Icon icon={ChevronRight} size={16} className="text-muted" /> : null}
    </button>
  );
}
