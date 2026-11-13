"use client";

import { Lock } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { EditorSlotProps } from "@/lib/editor";
import { applyItem, panelsOf, runSteps, type ApplyTarget } from "@/lib/panel-layers/apply";
import type { LibraryItem } from "@/lib/panel-layers/library";

/**
 * The pieces every studio library panel is built from (decision 0150): where an item goes (every
 * panel, or one), the tile and the swatch that apply it, and the line that says what happened. An
 * item is applied by the Library toolbar's own steps (`applyItem`, Y3), so the shell checks it
 * against the base article exactly as it checks a change made anywhere else.
 */

/** Applies library items to the design and remembers the sentence to show. */
export function useApply({ design, commands }: EditorSlotProps) {
  const [target, setTarget] = useState<ApplyTarget>({ kind: "all" });
  const [said, setSaid] = useState<string | null>(null);
  const apply = (item: LibraryItem) => setSaid(runSteps(applyItem(design, item, target), commands));
  return { target, setTarget, said, apply, panels: panelsOf(design, { kind: "all" }) };
}

export type Applier = ReturnType<typeof useApply>;

/** "Put it on": every panel, or the one panel chosen. */
export function TargetPicker({ applier, busy }: Readonly<{ applier: Applier; busy: boolean }>) {
  const id = useId();
  const value = applier.target.kind === "all" ? "" : applier.target.panelId;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-small text-muted">
        Put it on
      </label>
      <select
        id={id}
        value={value}
        disabled={busy}
        onChange={(event) => applier.setTarget(event.target.value === "" ? { kind: "all" } : { kind: "panel", panelId: event.target.value })}
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-small text-text"
      >
        <option value="">Every panel</option>
        {applier.panels.map((panelId) => (
          <option key={panelId} value={panelId}>
            {panelId}
          </option>
        ))}
      </select>
    </div>
  );
}

/** What the last press did, or why it did nothing. */
export function Said({ applier }: Readonly<{ applier: Applier }>) {
  return (
    <p role="status" className="text-small text-text empty:hidden" data-testid="studio-said">
      {applier.said}
    </p>
  );
}

/** A section of a panel: Fabra's bold heading, with an optional link on the right. */
export function ShelfSection({ title, action, children }: Readonly<{ title: string; action?: ReactNode; children: ReactNode }>) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-title text-text">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A plain sentence where a list would be, with the page that fills it. */
export function Empty({ children, href, link }: Readonly<{ children: ReactNode; href?: Route; link?: string }>) {
  return (
    <p className="text-small text-muted">
      {children}{" "}
      {href && link ? (
        <Link href={href} className="font-semibold text-link">
          {link}
        </Link>
      ) : null}
    </p>
  );
}

/** A fabric or repeat tile: a sample box and its name. A tile the design cannot store says why. */
export function Tile({ item, busy, onApply, locked = false }: Readonly<{ item: LibraryItem; busy: boolean; onApply: (item: LibraryItem) => void; locked?: boolean }>) {
  const cannot = item.apply.kind === "none" ? item.apply.reason : null;
  return (
    <li>
      <button
        type="button"
        disabled={busy || cannot !== null}
        title={cannot ?? undefined}
        onClick={() => onApply(item)}
        data-testid={`studio-item-${item.id}`}
        className="flex w-full flex-col gap-1.5 rounded-md text-left disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden="true" className="block h-14 w-full rounded-sm border border-border bg-soft" />
        <span className="flex items-center gap-1 text-small text-text">
          <span className="line-clamp-2">{item.label}</span>
          {locked ? (
            <>
              <Icon icon={Lock} size={14} className="text-muted" />
              <span className="sr-only">, not yet sampled</span>
            </>
          ) : null}
        </span>
        {item.code ? <span className="text-caption text-muted">{item.code}</span> : null}
      </button>
    </li>
  );
}

/** A colour swatch that applies its colour. The screen colour is the item's own data, so it is set inline. */
export function Swatch({ item, busy, onApply }: Readonly<{ item: LibraryItem; busy: boolean; onApply: (item: LibraryItem) => void }>) {
  return (
    <li>
      <button
        type="button"
        disabled={busy}
        onClick={() => onApply(item)}
        aria-label={item.code ? `${item.label}, ${item.code}` : item.label}
        title={item.label}
        data-testid={`studio-item-${item.id}`}
        className={cx("block h-12 w-full rounded-sm border border-border disabled:cursor-not-allowed disabled:opacity-40")}
        style={{ backgroundColor: item.swatch ?? undefined }}
      />
    </li>
  );
}
