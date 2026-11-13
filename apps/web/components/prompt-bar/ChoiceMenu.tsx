"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { useDismiss } from "@/components/ui/use-dismiss";
import { useRoving } from "@/components/ui/use-roving";

/**
 * A menu that opens **upwards** from the prompt bar's footer (decision 0149; `10` §8 menu values:
 * white, r-2xl, e3, 8 px padding, 40 px rows). Unlike the library's `Menu` its rows are a choice:
 * each is a `menuitemradio` with a ✓ on the picked one, and may carry a one-line lead under its
 * label, as Kittl's mode and model menus do.
 *
 * Keyboard: Enter or ↑/↓ on the trigger opens it on the picked row; arrows, Home and End move;
 * Enter chooses; Esc closes and returns focus to the trigger; Tab closes.
 */

export type ChoiceItem = Readonly<{
  id: string;
  label: string;
  lead?: string;
  icon?: ReactNode;
  /** Shown at the far right: a credit figure, a NEW pill, a ⓘ. */
  aside?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  /** Why a disabled row cannot be chosen. */
  title?: string;
}>;

type Props = Readonly<{
  /** The menu's name, and the trigger's aria-label. */
  label: string;
  trigger: ReactNode;
  items: readonly ChoiceItem[];
  onChoose: (id: string) => void;
  /** Above the rows: a search field, a heading. */
  header?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** False for a menu of actions (the + menu): plain `menuitem` rows with no ✓. */
  choice?: boolean;
  /** The trigger's look: the footer's text button, or a round icon button. */
  round?: boolean;
  testId?: string;
}>;

const WIDTH = { sm: "w-52", md: "w-72", lg: "w-90" } as const;

export function ChoiceMenu({ label, trigger, items, onChoose, header, footer, width = "sm", disabled = false, choice = true, round = false, testId }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const [inside] = useState(() => [panel, button]);
  useDismiss(open, close, inside, button);

  return (
    <span className="relative inline-flex">
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          setOpen(true);
        }}
        data-testid={testId}
        className={cx(
          "inline-flex h-9 items-center gap-1.5 text-body-lg font-medium text-text-2 transition-colors duration-fast live:hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 aria-expanded:bg-soft",
          round ? "w-9 justify-center rounded-full" : "rounded-md px-2",
        )}
      >
        {trigger}
      </button>
      {open ? (
        <ChoicePanel
          id={id}
          label={label}
          items={items}
          header={header}
          footer={footer}
          width={width}
          choice={choice}
          panel={panel}
          onClose={close}
          onChoose={(choice) => {
            setOpen(false);
            button.current?.focus();
            onChoose(choice);
          }}
        />
      ) : null}
    </span>
  );
}

type PanelProps = Readonly<{
  id: string;
  label: string;
  items: readonly ChoiceItem[];
  header?: ReactNode;
  footer?: ReactNode;
  width: keyof typeof WIDTH;
  choice: boolean;
  panel: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onChoose: (id: string) => void;
}>;

function ChoicePanel({ id, label, items, header, footer, width, choice, panel, onClose, onChoose }: PanelProps) {
  const usable = (index: number) => items[index]?.disabled !== true;
  const roving = useRoving<HTMLButtonElement>(items.length, () => undefined, "vertical", usable);
  useEffect(() => {
    if (header) return;
    const picked = items.findIndex((item) => item.checked && item.disabled !== true);
    roving.focus(picked >= 0 ? picked : items.findIndex((item) => item.disabled !== true));
    // Only when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={panel}
      onKeyDown={(event) => {
        if (event.key === "Tab") onClose();
      }}
      className={cx("absolute bottom-full left-0 z-[70] mb-2 flex max-h-112 flex-col rounded-2xl border border-border bg-bg p-2 shadow-e3 motion-safe:pop-in", WIDTH[width])}
    >
      {header}
      <div id={id} role="menu" aria-label={label} className="flex min-h-0 flex-col overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={roving.ref(index)}
            type="button"
            role={choice ? "menuitemradio" : "menuitem"}
            aria-checked={choice ? item.checked : undefined}
            tabIndex={-1}
            disabled={item.disabled}
            title={item.title}
            onClick={() => onChoose(item.id)}
            onKeyDown={roving.onKeyDown(index)}
            data-choice={item.id}
            className={cx(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-fast focus-visible:bg-soft focus-visible:outline-none live:hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40",
              item.checked && "bg-soft",
            )}
          >
            {item.icon}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-lg font-medium text-text">{item.label}</span>
              {item.lead ? <span className="text-small text-muted">{item.lead}</span> : null}
            </span>
            {item.aside}
            {item.checked ? <Icon icon={Check} size={16} className="shrink-0 text-text" /> : null}
          </button>
        ))}
      </div>
      {footer}
    </div>
  );
}
