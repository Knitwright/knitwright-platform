"use client";

import { useState } from "react";
import type { HistoryEntry, VersionView } from "@/lib/projects/editor-data";
import { VERSIONS_LISTED } from "@/lib/projects/limits";

/** How many entries show before the person asks for the rest. */
const HISTORY_SHOWN = 3;

type HistoryProps = Readonly<{
  entries: readonly HistoryEntry[];
  olderHidden: boolean;
  /** Restoring waits while a change is still on its way. */
  busy: boolean;
  onRestore: (version: number) => void;
}>;

/**
 * The saved versions, newest first. A run of quick edits by one person is one entry, and each of
 * its versions is listed inside it. The newest few show at first; the rest are a click away.
 * Restoring a version saves it again as the newest.
 */
export function History({ entries, olderHidden, busy, onRestore }: HistoryProps) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, HISTORY_SHOWN);
  const hidden = entries.length - shown.length;
  return (
    <>
      <ol className="flex flex-col divide-y divide-hairline">
        {shown.map((entry) => (
          <li key={entry.newest} className="py-3">
            <EntryRow entry={entry} busy={busy} onRestore={onRestore} />
          </li>
        ))}
      </ol>
      {entries.length > HISTORY_SHOWN ? (
        <button
          type="button"
          onClick={() => setAll(!all)}
          aria-expanded={all}
          className="mt-3 min-h-10 text-sm font-medium text-ink underline underline-offset-4"
        >
          {all ? "Show fewer" : `Show all (${hidden} more)`}
        </button>
      ) : null}
      {olderHidden && all ? (
        <p className="mt-3 text-sm text-muted">
          This list shows the newest {VERSIONS_LISTED} versions. Older versions are kept but are not listed here.
        </p>
      ) : null}
    </>
  );
}

type EntryProps = Readonly<{ entry: HistoryEntry; busy: boolean; onRestore: (version: number) => void }>;

function EntryRow({ entry, busy, onRestore }: EntryProps) {
  if (entry.versions.length === 1) return <VersionRow version={entry.versions[0]} busy={busy} onRestore={onRestore} />;
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-medium text-ink">
        {entry.title}
        {entry.isCurrent ? <span className="ml-2 text-sm font-normal text-muted">Current</span> : null}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">{entry.note}</p>
      <p className="mt-0.5 text-sm text-muted">{entry.when}</p>
      <details className="mt-2">
        <summary className="min-h-10 cursor-pointer text-sm font-medium text-ink">Show each change</summary>
        <ol className="mt-2 flex flex-col divide-y divide-hairline border-l border-hairline pl-3">
          {entry.versions.map((version) => (
            <li key={version.version} className="py-2">
              <VersionRow version={version} busy={busy} onRestore={onRestore} />
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

type VersionProps = Readonly<{ version: VersionView; busy: boolean; onRestore: (version: number) => void }>;

function VersionRow({ version, busy, onRestore }: VersionProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-ink">
          Version {version.version}
          {version.isCurrent ? <span className="ml-2 text-sm font-normal text-muted">Current</span> : null}
        </p>
        <p className="mt-0.5 text-sm text-ink-2">{version.note}</p>
        <p className="mt-0.5 text-sm text-muted">{version.when}</p>
      </div>
      {version.isCurrent ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRestore(version.version)}
          aria-label={`Restore version ${version.version}`}
          className="chip-btn min-h-10 shrink-0 rounded-full border border-white/20 px-3.5 py-1.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-55"
        >
          Restore
        </button>
      )}
    </div>
  );
}
