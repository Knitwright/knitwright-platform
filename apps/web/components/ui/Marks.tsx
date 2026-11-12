import { Crown, Lock } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * The custom marks of docs/spec/10-design-system.md §6. They are ours: none is taken from Kittl,
 * Printify or Fabra (decision 0131, rule 4).
 */

/** The KW credit coin: a gold circle with a navy "KW", 18 px. */
export function KwCoin({ label, className }: Readonly<{ label?: string; className?: string }>) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(
        "inline-grid size-4.5 shrink-0 place-items-center rounded-full bg-gold text-[8px] leading-none font-extrabold tracking-tight text-navy",
        className,
      )}
    >
      KW
    </span>
  );
}

/** ♛, the premium mark: gold, 12 px. Put it top-right of the thing it gates. */
export function PremiumMark({ label = "Premium", className }: Readonly<{ label?: string; className?: string }>) {
  return (
    <span role="img" aria-label={label} className={cx("inline-grid shrink-0 place-items-center text-gold", className)}>
      <Crown size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" focusable="false" />
    </span>
  );
}

/** 🔒 for a value only Knitwright QC can change: Lucide `lock`, 14 px, `muted`. */
export function LockMark({ label = "Locked", className }: Readonly<{ label?: string; className?: string }>) {
  return (
    <span role="img" aria-label={label} className={cx("inline-grid shrink-0 place-items-center text-muted", className)}>
      <Icon icon={Lock} size={14} />
    </span>
  );
}

/** The logo tile: a navy square, 12 px radius, gold "KW". Replaced by the final logo SVG when it arrives. */
export function LogoTile({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      role="img"
      aria-label="Knitwright"
      className={cx("inline-grid size-11 shrink-0 place-items-center rounded-lg bg-navy text-body font-extrabold text-gold", className)}
    >
      KW
    </span>
  );
}
