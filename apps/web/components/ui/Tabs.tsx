"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { useRoving } from "./use-roving";

/**
 * Tabs and the segmented control (docs/spec/10-design-system.md §8).
 *
 * - `Tabs variant="underline"` (panels, pages): 14/500 `muted`; the chosen tab is `text` with a
 *   2 px navy underline; 20 px gaps.
 * - `Tabs variant="pill"` (tech pack, Projects sub-tabs): 32 px, r-md; the chosen tab is navy.
 * - `Segmented`: a `soft` track with 4 px padding; the chosen segment is white with e1. For
 *   2D / 3D / Tech pack, Monthly / Yearly, List / Board.
 *
 * Arrow keys, Home and End move and choose; only the chosen one is in the tab order. A tab names
 * its panel: give the panel `{...tabPanelProps(idBase, id)}`.
 */

export type TabItem = Readonly<{ id: string; label: ReactNode; disabled?: boolean }>;

type TabsProps = Readonly<{
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** What the row of tabs is, for screen readers ("Projects"). */
  label: string;
  /** Joins each tab to its panel. */
  idBase: string;
  variant?: "underline" | "pill";
  className?: string;
}>;

export const tabId = (idBase: string, id: string): string => `${idBase}-tab-${id}`;
export const panelId = (idBase: string, id: string): string => `${idBase}-panel-${id}`;

/** The attributes of the panel a tab shows. */
export const tabPanelProps = (idBase: string, id: string) =>
  ({ role: "tabpanel", id: panelId(idBase, id), "aria-labelledby": tabId(idBase, id), tabIndex: 0 }) as const;

const TAB = {
  underline: {
    row: "gap-5 border-b border-border",
    tab: "relative -mb-px h-10 border-b-2 text-body font-medium transition-colors duration-fast ease-out",
    on: "border-navy text-text",
    off: "border-transparent text-muted live:hover:text-text",
  },
  pill: {
    row: "gap-1",
    tab: "h-8 rounded-md px-3 text-small font-semibold transition-colors duration-fast ease-out",
    on: "bg-navy text-on-dark",
    off: "text-text-2 live:hover:bg-soft",
  },
} as const;

export function Tabs({ items, value, onChange, label, idBase, variant = "underline", className }: TabsProps) {
  const style = TAB[variant];
  const roving = useRoving<HTMLButtonElement>(items.length, (index) => onChange(items[index].id), "horizontal", (index) => !items[index].disabled);
  return (
    <div role="tablist" aria-label={label} className={cx("flex items-center", style.row, className)}>
      {items.map((item, index) => {
        const on = item.id === value;
        return (
          <button
            key={item.id}
            ref={roving.ref(index)}
            type="button"
            role="tab"
            id={tabId(idBase, item.id)}
            aria-selected={on}
            aria-controls={panelId(idBase, item.id)}
            tabIndex={on ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={roving.onKeyDown(index)}
            className={cx(style.tab, on ? style.on : style.off, "disabled:cursor-not-allowed disabled:opacity-40")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

type SegmentedProps = Readonly<{
  options: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}>;

export function Segmented({ options, value, onChange, label, className }: SegmentedProps) {
  const roving = useRoving<HTMLButtonElement>(options.length, (index) => onChange(options[index].id), "horizontal", (index) => !options[index].disabled);
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex items-center gap-0.5 rounded-md bg-soft p-1", className)}>
      {options.map((option, index) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            ref={roving.ref(index)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
            onKeyDown={roving.onKeyDown(index)}
            className={cx(
              "h-8 rounded-sm px-3 text-small font-medium transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-40",
              on ? "bg-bg text-text shadow-e1" : "text-muted live:hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
