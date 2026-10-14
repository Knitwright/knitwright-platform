"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Dropped } from "@/lib/garment";

type SectionProps = Readonly<{ id: string; title: string | null; children: ReactNode }>;

/** A part of a tool panel. A panel with one part shows no heading of its own for it. */
export function Section({ id, title, children }: SectionProps) {
  if (!title) return <div className="flex flex-col gap-4">{children}</div>;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-white/10 pt-5 first:border-t-0 first:pt-0">
      <h3 id={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-chalk-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Says what is happening to the design. Screen readers hear each change of it. */
export function SaveStatus({ busy, status, className = "min-h-5 text-sm text-ink-2" }: Readonly<{ busy: boolean; status: string | null; className?: string }>) {
  return (
    <p role="status" className={className} data-testid="save-status">
      {busy ? "Saving" : (status ?? "")}
    </p>
  );
}

type DesignProblemProps = Readonly<{ message: string | null; conflict: boolean }>;

/** One message for the whole design: it was changed somewhere else, or undo could not run. */
export function DesignProblem({ message, conflict }: DesignProblemProps) {
  const router = useRouter();
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg bg-warn-wash px-4 py-3 text-sm leading-relaxed text-warn">
      <p>{message}</p>
      {conflict ? (
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            Reload
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DroppedNotice({ dropped }: Readonly<{ dropped: readonly Dropped[] }>) {
  if (dropped.length === 0) return null;
  return (
    <Notice tone="warn">
      <p className="font-medium">This change removed or reset some things.</p>
      <ul className="mt-2 list-disc pl-5">
        {dropped.map((entry, index) => (
          <li key={`${entry.kind}-${entry.id}-${index}`}>{entry.message}</li>
        ))}
      </ul>
    </Notice>
  );
}
