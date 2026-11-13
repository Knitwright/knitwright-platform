"use client";

import { useId, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * Small pieces the listing editor's sections share (09 screen 23; prototype p06): the white section card with its
 * anchor, the navy switch, and the 13/600 field label. Tokens only (10 §11).
 */

export function EditorCard({ id, title, meta, action, children }: Readonly<{ id: string; title: string; meta?: ReactNode; action?: ReactNode; children: ReactNode }>) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-4 rounded-xl border border-border bg-bg p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="flex items-baseline gap-2 text-h3 text-text">
          {title}
          {meta ? <span className="text-small font-normal text-muted">{meta}</span> : null}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** An on/off switch: a checkbox with the switch role, so a keyboard and a screen reader both know it. */
export function Switch({ checked, onChange, label, hideLabel = false, disabled = false }: Readonly<{ checked: boolean; onChange: (next: boolean) => void; label: string; hideLabel?: boolean; disabled?: boolean }>) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("inline-flex cursor-pointer items-center gap-3", disabled && "cursor-not-allowed opacity-40")}>
      <span className={hideLabel ? "sr-only" : "text-body text-text-2"}>{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true" className="h-6 w-11 rounded-full bg-border-strong transition-colors duration-fast peer-checked:bg-navy peer-focus-visible:ring-3 peer-focus-visible:ring-electric-soft" />
        <span aria-hidden="true" className="absolute top-0.5 left-0.5 size-5 rounded-full bg-bg shadow-e1 transition-transform duration-fast peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function FieldLabel({ htmlFor, children }: Readonly<{ htmlFor?: string; children: ReactNode }>) {
  return (
    <label htmlFor={htmlFor} className="text-small font-semibold text-text">
      {children}
    </label>
  );
}

/** A green tick, an amber dot or a red cross, with words for a screen reader. */
export function StateMark({ state }: Readonly<{ state: "ok" | "warn" | "block" }>) {
  const look = { ok: "border-ok text-ok", warn: "border-warn text-warn", block: "border-bad text-bad" }[state];
  const words = { ok: "Done", warn: "Warning", block: "Needed" }[state];
  return (
    <span className={cx("grid size-4 shrink-0 place-items-center rounded-full border text-micro", look)}>
      <span aria-hidden="true">{state === "ok" ? "✓" : "!"}</span>
      <span className="sr-only">{words}</span>
    </span>
  );
}
