"use client";

import { History, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Inputs";
import { useToast } from "@/components/ui/Toast";
import { useDismiss } from "@/components/ui/use-dismiss";
import { designHistoryAction, type DesignHistory } from "@/lib/pickers/actions";
import { LOCK_NOTE, shownRows, versionRows, type VersionRow } from "@/lib/pickers";
import { restoreVersionAction } from "@/lib/projects/actions";

/**
 * VERSION HISTORY (plan v6 E5, decision 0149; `08` v3.7 "Version history", `10` §8 popover at 360 px,
 * prototype e31): the clock icon by the project's name opens it.
 *
 * It lists the design's own saved versions with the status the validation gate gave each, newest
 * first (`lib/pickers/versions.ts`). **Show autosaves** hides the plain saves. An ordered version
 * carries 🔒: it is the one the factory made. **Restore** writes that version again as a new one
 * through the editor's own `restoreVersionAction`, so it never changes an order; a member who may
 * only look sees the list without Restore.
 */

type Props = Readonly<{
  /** The design whose history is shown, or null on a canvas with no garment. */
  designProjectId: string | null;
  canEdit: boolean;
  /** Made-up history for the /dev fixture, which has no database. Real pages never pass it. */
  fixture?: DesignHistory;
}>;

type Load = Readonly<{ state: "idle" | "loading" }> | Readonly<{ state: "error"; message: string }> | Readonly<{ state: "ready"; history: DesignHistory }>;

export function VersionHistory({ designProjectId, canEdit, fixture }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const [inside] = useState(() => [panel, trigger]);
  useDismiss(open, close, inside, trigger);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-label="Version history"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
        className="grid size-10 place-items-center rounded-md text-text-2 transition-colors duration-fast live:hover:bg-soft aria-expanded:bg-soft"
        data-testid="version-history-open"
      >
        <Icon icon={History} />
      </button>
      {open ? (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label="Version history"
          tabIndex={-1}
          className="absolute top-full right-0 z-[70] mt-2 flex w-90 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-border bg-bg p-4.5 text-body text-text shadow-e3 outline-none motion-safe:pop-in"
          data-testid="version-history"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-h3 text-text">Version history</h2>
            <button type="button" aria-label="Close" onClick={close} className="grid size-8 place-items-center rounded-full live:hover:bg-soft">
              <Icon icon={X} size={20} />
            </button>
          </div>
          {designProjectId === null ? (
            <p className="text-body text-muted">This canvas has no garment yet, so there is no design history to show. Add a garment board and its versions appear here.</p>
          ) : (
            <HistoryBody designProjectId={designProjectId} canEdit={canEdit} fixture={fixture} />
          )}
        </div>
      ) : null}
    </span>
  );
}

function HistoryBody({ designProjectId, canEdit, fixture }: Readonly<{ designProjectId: string; canEdit: boolean; fixture?: DesignHistory }>) {
  const router = useRouter();
  const toast = useToast();
  const [load, setLoad] = useState<Load>(fixture ? { state: "ready", history: fixture } : { state: "loading" });
  const [autosaves, setAutosaves] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  const [attempt, setAttempt] = useState(0);

  // Read on open and on every new attempt. State is only set when the answer comes back.
  useEffect(() => {
    if (fixture) return;
    let live = true;
    designHistoryAction({ projectId: designProjectId })
      .catch(() => null)
      .then((reply) => {
        if (!live) return;
        if (!reply) return setLoad({ state: "error", message: "The version history could not be reached. Check your connection." });
        setLoad(reply.success ? { state: "ready", history: reply.data } : { state: "error", message: reply.error.message });
      });
    return () => {
      live = false;
    };
  }, [designProjectId, fixture, attempt]);

  const read = (): void => {
    setLoad({ state: "loading" });
    setAttempt((n) => n + 1);
  };

  const restore = async (row: VersionRow, current: number): Promise<void> => {
    setRestoring(row.version);
    const reply = await restoreVersionAction({ projectId: designProjectId, expectedVersion: current, version: row.version }).catch(() => null);
    setRestoring(null);
    if (!reply || !reply.success) {
      return void toast.show({ tone: "error", title: "That version was not restored", body: reply ? reply.error.message : "Check your connection and try again." });
    }
    toast.show({ tone: "success", title: `Version ${row.version} restored`, body: "It is saved as the newest version. No order was changed." });
    router.refresh();
    read();
  };

  if (load.state === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-body text-bad-strong">{load.message}</p>
        <Button variant="secondary" size="sm" onClick={read}>
          Try again
        </Button>
      </div>
    );
  }

  if (load.state !== "ready") {
    return (
      <div aria-busy="true" aria-label="Loading versions" className="flex flex-col gap-2">
        {[0, 1, 2].map((one) => (
          <div key={one} className="skeleton-bar h-14 rounded-lg" />
        ))}
      </div>
    );
  }
  const history = load.history;
  const rows = shownRows(versionRows(history.versions, history.statuses, history.current), autosaves);
  return (
    <>
      <div className="border-b border-border pb-3">
        <Toggle checked={autosaves} onChange={setAutosaves} label="Show autosaves" />
      </div>
      <ul className="-mx-1 flex max-h-96 flex-col gap-1 overflow-y-auto" aria-label="Versions">
        {rows.map((row) => (
          <li key={row.version} className={cx("group flex items-center gap-3 rounded-lg px-3 py-2.5", row.current && "bg-soft")} data-version={row.version}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-lg font-semibold text-text">{row.title}</span>
              <span className="flex items-center gap-1 text-small text-muted">
                {row.line}
                {row.locked ? <Icon icon={Lock} size={14} className="text-gold-3" aria-label="Locked" /> : null}
              </span>
            </span>
            {row.canRestore && canEdit ? (
              <Button variant="secondary" size="xs" disabled={restoring !== null} onClick={() => void restore(row, history.current)} aria-label={`Restore version ${row.version}`}>
                {restoring === row.version ? "Restoring…" : "Restore"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {history.hasMore ? <p className="text-small text-muted">Older versions are in the design&apos;s own history.</p> : null}
      {!canEdit ? <p className="text-small text-muted">You can look at these versions. Only owners, admins and kit managers can restore one.</p> : null}
      <p className="text-small text-muted">{LOCK_NOTE}</p>
    </>
  );
}
