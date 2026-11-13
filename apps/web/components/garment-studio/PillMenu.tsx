"use client";

import { Check, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { useDismiss } from "@/components/ui/use-dismiss";
import { useRoving } from "@/components/ui/use-roving";

export type PillChoice = Readonly<{ id: string; label: string; swatch?: string | null }>;

type Props = Readonly<{
  /** What the pill chooses, for screen readers ("Kit colourway"). */
  label: string;
  icon: ReactNode;
  /** The words on the pill: the chosen value. */
  value: string;
  choices: readonly PillChoice[];
  chosen: string;
  onChoose: (id: string) => void;
  /** An extra last item under a line, such as "New colourway". */
  extra?: Readonly<{ label: string; testId: string; disabled: boolean; onSelect: () => void }>;
  testId: string;
  /** The chevron points up when the menu opens upward (`08` v3.7, s17, s18). */
  up?: boolean;
}>;

/**
 * A stage pill with its menu (plan v6 G1, decision 0150; `08` v3.7 "Colour and size pickers", s17,
 * s18): the chosen value on a white pill, and a menu above it with a tick on the chosen one. The menu
 * is a `menu` of `menuitemradio`s: the arrow keys, Home and End move; Enter or a press chooses; Esc or
 * a press outside closes and gives focus back to the pill.
 */
export function PillMenu({ label, icon, value, choices, chosen, onChoose, extra, testId, up = true }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const inside = useMemo(() => [box, trigger], []);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, inside, trigger);
  const count = choices.length + (extra ? 1 : 0);
  const roving = useRoving<HTMLButtonElement>(count, () => undefined, "vertical");
  const start = Math.max(0, choices.findIndex((choice) => choice.id === chosen));

  useEffect(() => {
    if (open) roving.focus(start);
    // Focus moves only when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (id: string) => {
    onChoose(id);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid={testId}
        className="inline-flex h-11 max-w-44 items-center gap-2 rounded-lg border border-border bg-bg px-3.5 text-body font-semibold text-text shadow-e1 live:hover:bg-soft"
      >
        {icon}
        <span className="truncate">{value}</span>
        <Icon icon={up ? ChevronUp : ChevronDown} size={16} className="text-muted" />
      </button>
      {open ? (
        <div ref={box} role="menu" aria-label={label} className={cx("absolute left-0 z-50 flex w-52 flex-col rounded-2xl border border-border bg-bg p-2 shadow-e3", up ? "bottom-full mb-2" : "top-full mt-2")}>
          {choices.map((choice, index) => (
            <button
              key={choice.id}
              ref={roving.ref(index)}
              type="button"
              role="menuitemradio"
              aria-checked={choice.id === chosen}
              tabIndex={-1}
              onKeyDown={roving.onKeyDown(index)}
              onClick={() => pick(choice.id)}
              className={cx("flex min-h-10 items-center gap-3 rounded-md px-2.5 text-body-lg text-text-2 live:hover:bg-soft", choice.id === chosen && "bg-soft text-text")}
            >
              {choice.swatch !== undefined ? <span aria-hidden="true" className="size-3.5 shrink-0 rounded-xs border border-border" style={{ backgroundColor: choice.swatch ?? undefined }} /> : null}
              <span className="flex-1 text-left">{choice.label}</span>
              {choice.id === chosen ? <Icon icon={Check} size={20} /> : null}
            </button>
          ))}
          {extra ? (
            <>
              <span role="separator" className="my-1.5 border-t border-border" />
              <button
                ref={roving.ref(choices.length)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={extra.disabled}
                onKeyDown={roving.onKeyDown(choices.length)}
                onClick={() => {
                  extra.onSelect();
                  setOpen(false);
                }}
                data-testid={extra.testId}
                className="flex min-h-10 items-center gap-3 rounded-md px-2.5 text-body-lg text-text-2 live:hover:bg-soft disabled:opacity-40"
              >
                <Icon icon={Plus} size={20} />
                {extra.label}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
