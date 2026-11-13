"use client";

import { useId, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import type { InspectorColourRow } from "@/lib/inspector/types";

/**
 * The inspector's building blocks (`10` §8 "Inspector (right panel)", e15–e26): a section with a
 * 17/600 header, 16 px padding and a divider; rows with the label on the left in `muted`; colour rows
 * with a 24 px swatch, the hex value and the opacity. Shared by every inspector E3 draws.
 */

export function Section({ title, aside, children, testId }: Readonly<{ title: string; aside?: ReactNode; children: ReactNode; testId?: string }>) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-b border-border p-4" data-testid={testId}>
      <header className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-title text-text">
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 text-body">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-text">{children}</span>
    </div>
  );
}

/** "0B1F4B", the way Kittl writes a colour: upper case, no hash. */
export const hexText = (hex: string | null): string => (hex === null ? "None" : hex.replace(/^#/, "").toUpperCase());

/**
 * A colour row. With `onPick` the swatch opens the browser's colour picker (E5 builds the Kittl
 * picker with its Brand tab; this row hands its choice to whatever opens). Without it, it is read only.
 */
export function ColourRow({ row, opacity = 100, busy = false, onPick }: Readonly<{ row: InspectorColourRow; opacity?: number; busy?: boolean; onPick?: (hex: string) => void }>) {
  const swatch = (
    <span
      aria-hidden="true"
      className={cx("size-6 shrink-0 rounded-xs border border-border", row.hex === null && "bg-soft")}
      style={row.hex === null ? undefined : { backgroundColor: row.hex }}
    />
  );
  return (
    <div className="flex min-h-10 items-center gap-3 text-body-lg text-text" data-testid={`colour-row-${row.id}`}>
      {onPick ? (
        <label className={cx("relative inline-flex cursor-pointer rounded-xs focus-within:outline-2 focus-within:outline-electric", busy && "cursor-wait opacity-60")}>
          {swatch}
          <input
            type="color"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            value={row.hex ?? "#ffffff"}
            disabled={busy}
            aria-label={`Colour of ${row.label}, ${hexText(row.hex)}`}
            onChange={(event) => onPick(event.target.value)}
          />
        </label>
      ) : (
        swatch
      )}
      <span className="w-20 font-medium">{hexText(row.hex)}</span>
      <span className="text-text-2">{opacity}%</span>
      <span className="ml-auto min-w-0 truncate text-caption text-muted" title={row.code ? `${row.label} · ${row.code}` : row.label}>
        {row.label}
      </span>
    </div>
  );
}

/** A chip in a single-choice group: Kittl's tile chips (Collar, Sleeve finish). */
export function ChoiceChip({ chosen, disabled, onChoose, children, testId }: Readonly<{ chosen: boolean; disabled?: boolean; onChoose: () => void; children: ReactNode; testId?: string }>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      disabled={disabled}
      onClick={onChoose}
      data-testid={testId}
      className={cx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-small font-semibold text-text transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40",
        chosen ? "border-navy outline-1 outline-navy" : "border-border bg-bg live:hover:bg-soft",
      )}
    >
      {children}
    </button>
  );
}

/** A tools button (Kittl's tool cards): an icon, a label, full width. */
export function ToolButton({ icon, children, onClick, disabled, testId }: Readonly<{ icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; testId?: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-bg px-3.5 text-body-lg font-semibold text-text-2 transition-colors duration-fast live:hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}
