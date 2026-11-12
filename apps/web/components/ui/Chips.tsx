import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

/**
 * Chips, pills and badges (docs/spec/10-design-system.md §8).
 *
 * - `FilterChip`: 32 px, r-full, a 1 px border, 13/500; chosen is navy. A count reads "Size · 3".
 * - `StatusPill`: 24 px, r-full, 12/600, in the status colours of §2.
 * - `Tag`: 20 px, r-xs, 11/700 uppercase: `KIT-SAFE` (ok), `BETA` (gold-soft and navy), `CLASS B`.
 * - `Badge`: a small count or "New" beside a name.
 */

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

const TONES: Readonly<Record<Tone, string>> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-link",
  neutral: "bg-soft text-text-2",
};

type FilterChipProps = Readonly<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    selected?: boolean;
    label: string;
    /** How many values of this filter are chosen: "Size · 3". */
    count?: number;
    icon?: ReactNode;
  }
>;

export function FilterChip({ selected = false, label, count, icon, className, ...rest }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-small font-medium whitespace-nowrap transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "border-navy bg-navy text-on-dark live:hover:bg-navy-2" : "border-border bg-bg text-text-2 live:hover:bg-soft",
        className,
      )}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 ? <span className="tabular-nums">· {count}</span> : null}
    </button>
  );
}

/** "In production", "Approved", "Out of tolerance". The words carry the meaning; the colour repeats it. */
export function StatusPill({ tone = "neutral", children, className }: Readonly<{ tone?: Tone; children: ReactNode; className?: string }>) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption font-semibold whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export type TagTone = "ok" | "beta" | "neutral" | "bad" | "info";

const TAG_TONES: Readonly<Record<TagTone, string>> = {
  ok: TONES.ok,
  beta: "bg-gold-soft text-navy",
  neutral: "bg-soft text-text-2",
  bad: TONES.bad,
  info: TONES.info,
};

export function Tag({ tone = "neutral", children, className }: Readonly<{ tone?: TagTone; children: ReactNode; className?: string }>) {
  return (
    <span
      className={cx(
        "inline-flex h-5 shrink-0 items-center rounded-xs px-1.5 text-micro font-bold whitespace-nowrap uppercase",
        TAG_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A count on a card's corner ("# 8") or a "New" beside a name. `gold` is the "New" look. */
export function Badge({
  tone = "dark",
  children,
  className,
}: Readonly<{ tone?: "dark" | "gold" | "neutral"; children: ReactNode; className?: string }>) {
  const look = { dark: "bg-text text-on-dark", gold: "bg-gold text-navy", neutral: "bg-soft text-text-2" }[tone];
  return (
    <span className={cx("inline-flex h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-caption font-bold tabular-nums", look, className)}>
      {children}
    </span>
  );
}
