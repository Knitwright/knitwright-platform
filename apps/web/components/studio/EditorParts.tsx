"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Dropped } from "@/lib/garment";
import type { EditorData } from "@/lib/projects/editor-data";

export function Section({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-hairline bg-surface p-6">
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type HeaderProps = Readonly<{ data: EditorData; busy: boolean; onUndo: () => void }>;

export function EditorHeader({ data, busy, onUndo }: HeaderProps) {
  const details = [data.styleNumber ? `Style ${data.styleNumber}` : null, data.season || null].filter(Boolean);
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          {data.typeLabel} for {data.wearerLabel.toLowerCase()}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{data.name}</h1>
        <p className="mt-2 text-sm text-muted">
          <span data-testid="version">Version {data.version}</span>
          {details.length > 0 ? <span>, {details.join(", ")}</span> : null}
        </p>
      </div>
      <Button type="button" variant="secondary" disabled={data.undoTo === null || busy} onClick={onUndo}>
        Undo
      </Button>
    </header>
  );
}

/** Says what is happening to the design. Screen readers hear each change of it. */
export function SaveStatus({ busy, status }: Readonly<{ busy: boolean; status: string | null }>) {
  return (
    <p role="status" className="min-h-5 text-sm text-ink-2" data-testid="save-status">
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
