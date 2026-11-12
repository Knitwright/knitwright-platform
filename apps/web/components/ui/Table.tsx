import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cx";
import { LockMark } from "./Marks";
import { Tooltip } from "./Tooltip";

/**
 * Tables (docs/spec/10-design-system.md §8). The header row is 12/600 `muted`, 40 px, no fill;
 * rows are 44 px `body` with 1 px dividers and a `soft` hover. Numbers are right-aligned and
 * tabular. The highlighted column (the sample size) is `gold-soft` at 600. A locked cell shows
 * 🔒, `muted` text, and a tooltip saying who can change it.
 */

export function Table({ caption, children, className }: Readonly<{ caption: string; children: ReactNode; className?: string }>) {
  return (
    <div className={cx("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-body text-text">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

type Cell = Readonly<{ numeric?: boolean; highlight?: boolean }>;

export function Th({ numeric, highlight, className, children, ...rest }: Readonly<ThHTMLAttributes<HTMLTableCellElement>> & Cell) {
  return (
    <th
      scope="col"
      {...rest}
      className={cx(
        "h-10 border-b border-border px-3 text-caption font-semibold whitespace-nowrap text-muted",
        numeric ? "text-right" : "text-left",
        highlight && "bg-gold-soft text-navy",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <tr className={cx("border-b border-border transition-colors duration-fast hover:bg-soft", className)}>{children}</tr>;
}

type TdProps = Readonly<TdHTMLAttributes<HTMLTableCellElement>> &
  Cell &
  Readonly<{
    /** Who can change this value, e.g. "Set by Knitwright QC after the golden sample". Locks the cell. */
    lockedReason?: string;
  }>;

export function Td({ numeric, highlight, lockedReason, className, children, ...rest }: TdProps) {
  return (
    <td
      {...rest}
      className={cx(
        "h-11 px-3",
        numeric && "text-right tabular-nums",
        highlight && "bg-gold-soft font-semibold",
        lockedReason && "text-muted",
        className,
      )}
    >
      {lockedReason ? (
        <span className={cx("inline-flex items-center gap-1.5", numeric && "justify-end")}>
          <Tooltip content={lockedReason}>
            <span tabIndex={0} className="inline-flex rounded-xs">
              <LockMark label="Locked" />
            </span>
          </Tooltip>
          {children}
        </span>
      ) : (
        children
      )}
    </td>
  );
}
